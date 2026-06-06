import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  decryptIfEncrypted,
  encrypt,
  isLegacyFormat,
} from '@/lib/whatsapp/encryption'
import { getMediaUrl } from '@/lib/whatsapp/meta-api'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import {
  describeWebhookSignatureSources,
  loadWebhookSignatureSecrets,
} from '@/lib/whatsapp/webhook-secrets'
import {
  isWebhookDebugEnabled,
  logWebhook,
  maskId,
  newWebhookRequestId,
  summarizeWebhookBody,
} from '@/lib/whatsapp/webhook-log'
import type { WhatsAppWebhookEntry } from '@/lib/whatsapp/webhook-types'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchInboundToFlows } from '@/lib/flows/engine'
import {
  handleTemplateWebhookChange,
  isTemplateWebhookField,
} from '@/lib/whatsapp/template-webhook'

export const runtime = 'nodejs'

// Lazy-initialized to avoid build-time crash when env vars are missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

interface WhatsAppMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  video?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string }
  audio?: { id: string; mime_type: string }
  sticker?: { id: string; mime_type: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  reaction?: { message_id: string; emoji: string }
  /**
   * Set when the customer taps a button or list row on an interactive
   * message we sent. `button_reply.id` / `list_reply.id` is whatever id
   * we put on the button/row when sending — the Flows engine uses this
   * to advance the per-contact run.
   */
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  /** Present when the customer swipe-replies to one of our messages. */
  context?: { id: string }
}

// GET - Webhook verification
export async function GET(request: Request) {
  const requestId = newWebhookRequestId()
  const startedAt = Date.now()
  logWebhook('info', 'verify_request', {
    request_id: requestId,
    method: 'GET',
    user_agent: request.headers.get('user-agent'),
  })

  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      logWebhook('warn', 'verify_rejected', {
        request_id: requestId,
        reason: 'missing_params',
        mode,
        has_challenge: Boolean(challenge),
        has_verify_token: Boolean(verifyToken),
        duration_ms: Date.now() - startedAt,
      })
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      )
    }

    const envVerifyTokens = [
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      process.env.META_WEBHOOK_VERIFY_TOKEN,
    ]
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)

    if (envVerifyTokens.includes(verifyToken)) {
      logWebhook('info', 'verify_ok', {
        request_id: requestId,
        config_id: null,
        config_rows: 0,
        rows_with_verify_token: 0,
        verify_token_decrypt_failures: 0,
        duration_ms: Date.now() - startedAt,
      })
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Fetch all whatsapp configs to check verify tokens
    const { data: configs, error: configError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('id, verify_token')

    if (configError || !configs) {
      logWebhook('error', 'verify_failed', {
        request_id: requestId,
        reason: 'config_fetch_error',
        error: configError?.message ?? 'no rows',
        duration_ms: Date.now() - startedAt,
      })
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 403 }
      )
    }

    const rowsWithToken = configs.filter((c: { verify_token: string | null }) =>
      Boolean(c.verify_token),
    ).length

    // Check if any config's verify_token matches. Also collect the
    // matching row so we can opportunistically upgrade its token to
    // GCM if it was still in the legacy CBC format.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchedConfig: any = null
    let shouldUpgradeToken = false
    let decryptFailures = 0
    for (const config of configs) {
      if (!config.verify_token) continue
      try {
        const decoded = decryptIfEncrypted(config.verify_token)
        if (decoded.plaintext === verifyToken) {
          matchedConfig = config
          shouldUpgradeToken =
            !decoded.encrypted || decoded.legacy || isLegacyFormat(config.verify_token)
          break
        }
      } catch {
        decryptFailures++
      }
    }

    if (matchedConfig) {
      logWebhook('info', 'verify_ok', {
        request_id: requestId,
        config_id: maskId(matchedConfig.id),
        config_rows: configs.length,
        rows_with_verify_token: rowsWithToken,
        verify_token_decrypt_failures: decryptFailures,
        duration_ms: Date.now() - startedAt,
      })
      // Fire-and-forget GCM upgrade. Safe to run on every subscribe
      // since it's a no-op once the column is already GCM.
      if (shouldUpgradeToken) {
        void supabaseAdmin()
          .from('whatsapp_config')
          .update({ verify_token: encrypt(verifyToken) })
          .eq('id', matchedConfig.id)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              logWebhook('warn', 'verify_token_upgrade_failed', {
                request_id: requestId,
                config_id: maskId(matchedConfig.id),
                error: (error as { message?: string })?.message ?? String(error),
              })
            }
          })
      }
      // Return challenge as plain text
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    logWebhook('warn', 'verify_rejected', {
      request_id: requestId,
      reason: 'token_mismatch',
      config_rows: configs.length,
      rows_with_verify_token: rowsWithToken,
      verify_token_decrypt_failures: decryptFailures,
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Verification token mismatch' },
      { status: 403 }
    )
  } catch (error) {
    logWebhook('error', 'verify_exception', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Receive messages
export async function POST(request: Request) {
  const requestId = newWebhookRequestId()
  const startedAt = Date.now()
  try {
    const admin = supabaseAdmin()
    const secretSources = await describeWebhookSignatureSources(admin)

    logWebhook('info', 'post_received', {
      request_id: requestId,
      method: 'POST',
      user_agent: request.headers.get('user-agent'),
      content_type: request.headers.get('content-type'),
      content_length: request.headers.get('content-length'),
      content_encoding: request.headers.get('content-encoding'),
      x_forwarded_for: request.headers.get('x-forwarded-for'),
      x_forwarded_proto: request.headers.get('x-forwarded-proto'),
      ...secretSources,
      debug_verbose: isWebhookDebugEnabled(),
    })

    const rawBodyBytes = new Uint8Array(await request.arrayBuffer())
    const rawBody = new TextDecoder().decode(rawBodyBytes)

    const signature256 = request.headers.get('x-hub-signature-256')
    const signature1 = request.headers.get('x-hub-signature')
    const signature = signature256 ?? signature1
    const signatureHeaderName = signature256
      ? 'x-hub-signature-256'
      : signature1
        ? 'x-hub-signature'
        : null
    const signatureSecrets = await loadWebhookSignatureSecrets(admin)

    const signatureOk = await verifyMetaWebhookSignature(
      rawBodyBytes,
      signature,
      signatureSecrets,
    )
    if (!signatureOk) {
      const reason =
        signatureSecrets.length === 0
          ? 'no_app_secret'
          : !signature
            ? 'missing_signature_header'
            : 'signature_mismatch'

      logWebhook('warn', 'post_rejected', {
        request_id: requestId,
        reason,
        body_bytes: rawBodyBytes.byteLength,
        has_signature_header: Boolean(signature),
        signature_header: signatureHeaderName,
        signature_prefix: signature?.slice(0, 12) ?? null,
        ...secretSources,
        duration_ms: Date.now() - startedAt,
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    logWebhook('info', 'post_signature_ok', {
      request_id: requestId,
      body_bytes: rawBodyBytes.byteLength,
      signature_header: signatureHeaderName,
    })

    let body: { object?: string; entry?: WhatsAppWebhookEntry[] }
    try {
      body = JSON.parse(rawBody)
    } catch {
      logWebhook('warn', 'post_rejected', {
        request_id: requestId,
        reason: 'invalid_json',
        body_bytes: rawBodyBytes.byteLength,
        duration_ms: Date.now() - startedAt,
      })
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const summary = summarizeWebhookBody(body)
    logWebhook('info', 'post_accepted', {
      request_id: requestId,
      body_bytes: rawBodyBytes.byteLength,
      ...summary,
      duration_ms: Date.now() - startedAt,
    })

    // Process the webhook asynchronously
    const processStartedAt = Date.now()
    processWebhook(body, requestId)
      .then(async () => {
        logWebhook('info', 'process_complete', {
          request_id: requestId,
          ...summary,
          process_duration_ms: Date.now() - processStartedAt,
        })
      })
      .catch((error) => {
        logWebhook('error', 'process_failed', {
          request_id: requestId,
          ...summary,
          error: error instanceof Error ? error.message : String(error),
          process_duration_ms: Date.now() - processStartedAt,
        })
      })

    return NextResponse.json({ status: 'received' }, { status: 200 })
  } catch (error) {
    logWebhook('error', 'post_exception', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processWebhook(
  body: { entry?: WhatsAppWebhookEntry[] },
  requestId: string,
) {
  if (!body.entry) {
    logWebhook('warn', 'process_skipped', {
      request_id: requestId,
      reason: 'no_entry_array',
    })
    return
  }

  logWebhook('info', 'process_start', {
    request_id: requestId,
    ...summarizeWebhookBody(body),
  })

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      // Template-lifecycle events (status / quality / components
      // updates from Meta) come in on a different change.field and
      // have a different value shape — route them through the
      // dedicated handler. Skip the messaging branches below so we
      // don't try to read message-shaped fields off a template event.
      if (isTemplateWebhookField(change.field)) {
        logWebhook('info', 'change_template', {
          request_id: requestId,
          field: change.field,
        })
        await handleTemplateWebhookChange(
          { field: change.field, value: change.value as unknown },
          supabaseAdmin(),
        )
        continue
      }

      const value = change.value

      // Handle status updates
      if (value.statuses) {
        logWebhook('info', 'change_statuses', {
          request_id: requestId,
          count: value.statuses.length,
          phone_number_id: maskId(value.metadata?.phone_number_id),
        })
        for (const status of value.statuses) {
          await handleStatusUpdate(status)
        }
      }

      // Handle incoming messages
      if (!value.messages || !value.contacts) continue

      const phoneNumberId = value.metadata.phone_number_id

      logWebhook('info', 'change_messages', {
        request_id: requestId,
        phone_number_id: maskId(phoneNumberId),
        message_count: value.messages.length,
        message_types: value.messages.map((m) => m.type),
      })

      // Find user's config by phone_number_id. `.single()` returns
      // PGRST116 for both 0 rows AND ≥2 rows — distinguish them so
      // operators see the real cause in logs. ≥2 rows shouldn't happen
      // post-migration 013 (UNIQUE constraint), but a row created
      // before the constraint, or a race, would still surface here.
      const { data: configRows, error: configError } = await supabaseAdmin()
        .from('whatsapp_config')
        .select('*')
        .eq('phone_number_id', phoneNumberId)

      if (configError) {
        logWebhook('error', 'config_lookup_failed', {
          request_id: requestId,
          phone_number_id: maskId(phoneNumberId),
          message: configError.message,
        })
        console.error(
          'Error fetching whatsapp_config for phone_number_id:',
          phoneNumberId,
          configError
        )
        continue
      }

      if (!configRows || configRows.length === 0) {
        logWebhook('warn', 'config_not_found', {
          request_id: requestId,
          phone_number_id: maskId(phoneNumberId),
          hint: 'Save this Phone Number ID in Settings → WhatsApp Config',
        })
        console.error('No config found for phone_number_id:', phoneNumberId)
        continue
      }

      if (configRows.length > 1) {
        logWebhook('error', 'config_duplicate', {
          request_id: requestId,
          phone_number_id: maskId(phoneNumberId),
          row_count: configRows.length,
        })
        console.error(
          `Multiple configs (${configRows.length}) found for phone_number_id:`,
          phoneNumberId,
          '— inbound message dropped. Resolve duplicates so each number maps to a single account.',
          'Account owners:',
          configRows.map((r: { account_id: string; user_id: string }) => `${r.account_id} (admin ${r.user_id})`)
        )
        continue
      }

      const config = configRows[0]

      logWebhook('info', 'config_matched', {
        request_id: requestId,
        account_id: maskId(config.account_id),
        phone_number_id: maskId(phoneNumberId),
        registered: Boolean(config.registered_at),
      })

      let decryptedAccessToken: string
      try {
        const decodedToken = decryptIfEncrypted(config.access_token)
        decryptedAccessToken = decodedToken.plaintext
        if (!decodedToken.encrypted || decodedToken.legacy) {
          void supabaseAdmin()
            .from('whatsapp_config')
            .update({ access_token: encrypt(decryptedAccessToken) })
            .eq('id', config.id)
        }
      } catch (err) {
        logWebhook('error', 'access_token_decrypt_failed', {
          request_id: requestId,
          phone_number_id: maskId(phoneNumberId),
          account_id: maskId(config.account_id),
          error: err instanceof Error ? err.message : String(err),
        })
        continue
      }

      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i]
        const contact = value.contacts[i] || value.contacts[0]

        logWebhook('info', 'message_processing', {
          request_id: requestId,
          meta_message_id: maskId(message.id),
          type: message.type,
        })

        await processMessage(
          message,
          contact,
          // Tenancy — drives every contact / conversation lookup
          // and the engines' active-row dispatch.
          config.account_id,
          // Audit / sender-of-record — used as the user_id on row
          // inserts that need it for NOT NULL FK compliance. Always
          // the admin who saved the WhatsApp config.
          config.user_id,
          decryptedAccessToken,
          requestId,
        )
      }
    }
  }
}

// The happy-path status ladder — pending → sent → delivered → read →
// replied. Webhook replays must never regress a recipient back down
// this ladder.
//
// `failed` is NOT on this ladder. It's a terminal side branch that is
// only valid from the early states (pending / sent) — once Meta has
// delivered or the user has read or replied, a later "failed" status
// event is a bug in Meta's pipeline or a spoof attempt and must be
// ignored.
const RECIPIENT_STATUS_LADDER = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
] as const

function ladderLevel(s: string): number {
  const idx = (RECIPIENT_STATUS_LADDER as readonly string[]).indexOf(s)
  return idx < 0 ? -1 : idx
}

/**
 * Can a recipient transition from `current` to `incoming`?
 *   - Along the ladder, only forward moves are allowed.
 *   - `failed` is accepted only from `pending` or `sent`; it's refused
 *     once the recipient has reached any of the success states.
 */
function isValidStatusTransition(current: string, incoming: string): boolean {
  if (incoming === 'failed') {
    return current === 'pending' || current === 'sent'
  }
  if (current === 'failed') {
    return false // failed is terminal
  }
  const ci = ladderLevel(current)
  const ii = ladderLevel(incoming)
  if (ii < 0) return false // unknown incoming status
  if (ci < 0) return true // unknown current — accept anything on the ladder
  return ii > ci
}

async function handleStatusUpdate(status: {
  id: string
  status: string
  timestamp: string
  recipient_id: string
  errors?: Array<{ code?: number; title?: string; message?: string }>
}) {
  if (status.status === 'failed' && status.errors?.length) {
    logWebhook('warn', 'message_delivery_failed', {
      message_id: maskId(status.id),
      recipient_id: status.recipient_id,
      errors: status.errors.map((e) => ({
        code: e.code,
        title: e.title,
        message: e.message,
      })),
    })
  }
  // 1) Mirror onto messages (legacy behavior) — Meta's status values
  //    already match the CHECK constraint on messages.status.
  const { error: msgErr } = await supabaseAdmin()
    .from('messages')
    .update({ status: status.status })
    .eq('message_id', status.id)

  if (msgErr) {
    console.error('Error updating message status:', msgErr)
  }

  // 2) Mirror onto broadcast_recipients via whatsapp_message_id
  //    (added in migration 003). The aggregate trigger on
  //    broadcast_recipients re-derives the parent broadcast's
  //    sent/delivered/read/failed counts automatically.
  const tsIso = new Date(parseInt(status.timestamp) * 1000).toISOString()

  const { data: recipient, error: recFetchErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', status.id)
    .maybeSingle()

  if (recFetchErr) {
    console.error('Error fetching broadcast recipient:', recFetchErr)
    return
  }
  if (!recipient) return // message wasn't part of a broadcast — fine

  // Guard transitions — forward-only on the success ladder, and
  // `failed` only from pre-delivered states.
  if (!isValidStatusTransition(recipient.status, status.status)) return

  const update: Record<string, unknown> = { status: status.status }
  if (status.status === 'sent' && !('sent_at' in update)) update.sent_at = tsIso
  if (status.status === 'delivered') update.delivered_at = tsIso
  if (status.status === 'read') update.read_at = tsIso

  const { error: recUpdateErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .update(update)
    .eq('id', recipient.id)

  if (recUpdateErr) {
    console.error('Error updating broadcast recipient status:', recUpdateErr)
  }
}

/**
 * If an inbound message's sender is on a still-unreplied
 * broadcast_recipients row, flip it to `replied` so the reply count
 * advances on the parent broadcast.
 *
 * Runs on a best-effort basis — failures here must not break the
 * main inbound-message flow, so errors are swallowed with a log.
 */
async function flagBroadcastReplyIfAny(accountId: string, contactId: string) {
  try {
    // Most recent outbound broadcast in this account that hasn't
    // been replied to yet. Account-scoped so a shared inbox reply
    // marks the broadcast as replied regardless of which teammate
    // sent it.
    const { data: recs, error } = await supabaseAdmin()
      .from('broadcast_recipients')
      .select('id, status, broadcast_id, broadcasts!inner(account_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.account_id', accountId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !recs || recs.length === 0) return

    const row = recs[0]
    const { error: updErr } = await supabaseAdmin()
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', row.id)

    if (updErr) {
      console.error('Error marking broadcast recipient replied:', updErr)
    }
  } catch (err) {
    console.error('flagBroadcastReplyIfAny failed:', err)
  }
}

/**
 * Resolve a Meta-side message_id into the matching internal UUID, scoped
 * to one conversation. Returns null when we never received the parent
 * (e.g. a swipe-reply to a message older than this CRM install).
 */
async function lookupInternalIdByMetaId(
  metaId: string,
  conversationId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('messages')
    .select('id')
    .eq('message_id', metaId)
    .eq('conversation_id', conversationId)
    .maybeSingle()
  if (error) {
    console.error('[webhook] lookupInternalIdByMetaId failed:', error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Persist an inbound reaction. WhatsApp reactions are not new messages —
 * they're per-(target, actor) state. We upsert / delete on
 * `message_reactions`, never write a row into `messages`.
 *
 * Best-effort: a missing parent (we never received it) is logged and
 * skipped so the webhook still acks 200 to Meta.
 */
async function handleReaction(
  message: WhatsAppMessage,
  conversationId: string,
  contactId: string
) {
  const reaction = message.reaction
  if (!reaction?.message_id) return

  const targetInternalId = await lookupInternalIdByMetaId(
    reaction.message_id,
    conversationId
  )
  if (!targetInternalId) {
    console.warn(
      '[webhook] reaction target message not found; skipping',
      reaction.message_id
    )
    return
  }

  // Empty emoji = removal (per Meta's Cloud API spec).
  if (!reaction.emoji) {
    const { error: delError } = await supabaseAdmin()
      .from('message_reactions')
      .delete()
      .eq('message_id', targetInternalId)
      .eq('actor_type', 'customer')
      .eq('actor_id', contactId)
    if (delError) {
      console.error('[webhook] reaction delete failed:', delError.message)
    }
    return
  }

  const { error: upsertError } = await supabaseAdmin()
    .from('message_reactions')
    .upsert(
      {
        message_id: targetInternalId,
        conversation_id: conversationId,
        actor_type: 'customer',
        actor_id: contactId,
        emoji: reaction.emoji,
      },
      { onConflict: 'message_id,actor_type,actor_id' }
    )
  if (upsertError) {
    console.error('[webhook] reaction upsert failed:', upsertError.message)
  }
}

async function processMessage(
  message: WhatsAppMessage,
  contact: { profile: { name: string }; wa_id: string },
  // Tenancy. Resolved from the matched whatsapp_config row; every
  // contact / conversation / message row created downstream is
  // stamped with this so any member of the account can see it.
  accountId: string,
  // Sender-of-record for inserts that need a NOT NULL user_id FK
  // (contacts, conversations). Always the admin who saved the
  // WhatsApp config; the choice is arbitrary post-017 but stable.
  configOwnerUserId: string,
  accessToken: string,
  requestId: string,
) {
  const senderPhone = normalizePhone(message.from)
  const contactName = contact.profile.name

  // Find or create contact
  const contactOutcome = await findOrCreateContact(
    accountId,
    configOwnerUserId,
    senderPhone,
    contactName
  )
  if (!contactOutcome) {
    logWebhook('warn', 'message_skipped', {
      request_id: requestId,
      reason: 'contact_create_failed',
      meta_message_id: maskId(message.id),
      type: message.type,
    })
    return
  }
  const contactRecord = contactOutcome.contact

  // Find or create conversation
  const conversation = await findOrCreateConversation(
    accountId,
    configOwnerUserId,
    contactRecord.id
  )
  if (!conversation) {
    logWebhook('warn', 'message_skipped', {
      request_id: requestId,
      reason: 'conversation_create_failed',
      meta_message_id: maskId(message.id),
      type: message.type,
    })
    return
  }

  // Reactions short-circuit here — they aren't messages. We never insert
  // into `messages`, never bump unread_count, never update last_message_text.
  // Done before parseMessageContent so the media-URL fetch is skipped.
  if (message.type === 'reaction') {
    await handleReaction(message, conversation.id, contactRecord.id)
    logWebhook('info', 'message_reaction_handled', {
      request_id: requestId,
      meta_message_id: maskId(message.id),
    })
    return
  }

  // Parse message content based on type
  const { contentText, mediaUrl, mediaType, interactiveReplyId } =
    await parseMessageContent(message, accessToken)

  // Resolve swipe-reply context if present. A missing parent is fine —
  // we just store NULL and the UI renders the message without a quote.
  let replyToInternalId: string | null = null
  if (message.context?.id) {
    replyToInternalId = await lookupInternalIdByMetaId(
      message.context.id,
      conversation.id
    )
    if (!replyToInternalId) {
      console.warn(
        '[webhook] reply context parent not found:',
        message.context.id
      )
    }
  }

  // Insert message — field names MUST match the messages table schema
  // (see supabase/migrations/001_initial_schema.sql):
  //   conversation_id, sender_type, content_type, content_text,
  //   media_url, template_name, message_id, status, created_at
  // `mediaType` is intentionally unused — the schema has no media_type
  // column; the MIME type is only used to construct the proxy URL during
  // parseMessageContent. Silence the unused-var warning:
  void mediaType

  // The messages.content_type CHECK constraint (widened in migration 010
  // to add 'interactive' for button/list taps) allows:
  //   text, image, document, audio, video, location, template, interactive
  // Map incoming WhatsApp types that aren't in that list to the closest
  // allowed value so the INSERT doesn't fail with a constraint error.
  const ALLOWED_CONTENT_TYPES = new Set([
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive',
  ])
  const contentType = ALLOWED_CONTENT_TYPES.has(message.type)
    ? message.type
    : message.type === 'sticker'
      ? 'image'   // stickers are images
      : 'text'    // reaction, unknown → text fallback

  // Determine whether this is the contact's very first inbound message
  // BEFORE we insert, so the count is accurate. Covers the case where
  // the contact row already exists (manual add / CSV import) but they've
  // never messaged us before — which new_contact_created wouldn't catch.
  const { count: priorCustomerMsgCount } = await supabaseAdmin()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  const { error: msgError } = await supabaseAdmin().from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: message.id,
    status: 'delivered',
    created_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    reply_to_message_id: replyToInternalId,
    // Only populated for content_type='interactive'. Migration 010 added
    // the column; null for every other content_type so existing inserts
    // behave identically.
    interactive_reply_id: interactiveReplyId,
  })

  if (msgError) {
    logWebhook('error', 'message_insert_failed', {
      request_id: requestId,
      meta_message_id: maskId(message.id),
      type: message.type,
      content_type: contentType,
      error: msgError.message,
      code: msgError.code,
    })
    console.error('Error inserting message:', msgError)
    return
  }

  logWebhook('info', 'message_saved', {
    request_id: requestId,
    meta_message_id: maskId(message.id),
    type: message.type,
    content_type: contentType,
    conversation_id: maskId(conversation.id),
    first_inbound: isFirstInboundMessage,
    new_contact: contactOutcome.wasCreated,
  })

  // Update conversation
  const { error: convError } = await supabaseAdmin()
    .from('conversations')
    .update({
      last_message_text: contentText || `[${message.type}]`,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  if (convError) {
    console.error('Error updating conversation:', convError)
  }

  // If this contact was a recent broadcast recipient, flag the reply
  // so the broadcast's `replied_count` advances (via the aggregate
  // trigger installed in migration 003).
  await flagBroadcastReplyIfAny(accountId, contactRecord.id)

  // ============================================================
  // Flow runner dispatch.
  //
  // If the runner consumes the message (it either advanced an active
  // run or started a new one), we suppress the `new_message_received`
  // + `keyword_match` automation triggers for this inbound. Customer
  // is navigating the bot menu, not sending a fresh trigger word
  // that should fork into automations.
  //
  // The relationship-level triggers (`new_contact_created`,
  // `first_inbound_message`) still fire even when consumed — those
  // are about WHO is messaging, not what they said.
  //
  // Awaited (not fire-and-forget) because we need the `consumed`
  // result before deciding whether to dispatch automations. The
  // runner has its own try/catch and never throws. Accounts with
  // no active flows take the runner's early-exit "no_match" path
  // basically for free (one indexed SELECT for the active run).
  // ============================================================
  const flowResult = await dispatchInboundToFlows({
    accountId,
    userId: configOwnerUserId,
    contactId: contactRecord.id,
    conversationId: conversation.id,
    message:
      interactiveReplyId
        ? {
            kind: 'interactive_reply',
            reply_id: interactiveReplyId,
            reply_title: contentText ?? '',
            meta_message_id: message.id,
          }
        : {
            kind: 'text',
            text: contentText ?? message.text?.body ?? '',
            meta_message_id: message.id,
          },
    isFirstInboundMessage,
  })
  const flowConsumed = flowResult.consumed

  // Fire any automations that react to this webhook event. All dispatches
  // run here (not earlier) so the contact, conversation, and inbound
  // message all exist before any step — including send_message — runs.
  // Fire-and-forget: a slow or failing automation must not block the
  // webhook's 200 OK response to Meta.
  const inboundText = contentText ?? message.text?.body ?? ''
  const automationTriggers: (
    | 'new_contact_created'
    | 'first_inbound_message'
    | 'new_message_received'
    | 'keyword_match'
  )[] = []
  // Content-level triggers are suppressed when a flow consumed the
  // message — see the comment block above.
  if (!flowConsumed) {
    automationTriggers.push('new_message_received', 'keyword_match')
  }
  // new_contact_created fires only when the webhook just auto-created the
  // contact row. first_inbound_message fires whenever this is the contact's
  // first-ever customer-sent message — a superset that also catches
  // manually-imported contacts sending for the first time. We dispatch both
  // so users can pick whichever semantic they want; an automation that
  // listens to only one trigger runs only when that trigger matches.
  if (contactOutcome.wasCreated) automationTriggers.unshift('new_contact_created')
  if (isFirstInboundMessage) automationTriggers.unshift('first_inbound_message')
  for (const triggerType of automationTriggers) {
    runAutomationsForTrigger({
      accountId,
      triggerType,
      contactId: contactRecord.id,
      context: {
        message_text: inboundText,
        conversation_id: conversation.id,
      },
    }).catch((err) => console.error('[automations] dispatch failed:', err))
  }
}

async function parseMessageContent(
  message: WhatsAppMessage,
  accessToken: string
): Promise<{
  contentText: string | null
  mediaUrl: string | null
  mediaType: string | null
  /**
   * For interactive button / list replies: the stable id of the tapped
   * option (whatever we put on the button when sending). Used by the
   * Flows engine to advance the per-contact run; persisted to
   * `messages.interactive_reply_id` so the inbox bubble can render the
   * tap with the right affordance. Null for everything else.
   */
  interactiveReplyId: string | null
}> {
  // getMediaUrl signature is (mediaId, accessToken) — earlier code had
  // the args swapped, so every verification hit an invalid Meta URL and
  // fell through to the catch block, leaving mediaUrl as null. That's
  // why images showed up as empty bubbles in the inbox.
  const verifyAndBuildUrl = async (
    mediaId: string
  ): Promise<string | null> => {
    try {
      await getMediaUrl({ mediaId, accessToken })
      return `/api/whatsapp/media/${mediaId}`
    } catch (error) {
      console.error(
        `Failed to verify media ${mediaId} with Meta:`,
        error instanceof Error ? error.message : error
      )
      return null
    }
  }

  // Default shape — each case overrides only the fields it cares about.
  // Keeps the new `interactiveReplyId` field DRY across every return site.
  const empty = {
    contentText: null,
    mediaUrl: null,
    mediaType: null,
    interactiveReplyId: null,
  }

  switch (message.type) {
    case 'text':
      return { ...empty, contentText: message.text?.body || null }

    case 'image':
      if (message.image?.id) {
        return {
          ...empty,
          contentText: message.image.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.image.id),
          mediaType: message.image.mime_type,
        }
      }
      return empty

    case 'video':
      if (message.video?.id) {
        return {
          ...empty,
          contentText: message.video.caption || null,
          mediaUrl: await verifyAndBuildUrl(message.video.id),
          mediaType: message.video.mime_type,
        }
      }
      return empty

    case 'document':
      if (message.document?.id) {
        return {
          ...empty,
          contentText:
            message.document.caption || message.document.filename || null,
          mediaUrl: await verifyAndBuildUrl(message.document.id),
          mediaType: message.document.mime_type,
        }
      }
      return empty

    case 'audio':
      if (message.audio?.id) {
        return {
          ...empty,
          mediaUrl: await verifyAndBuildUrl(message.audio.id),
          mediaType: message.audio.mime_type,
        }
      }
      return empty

    case 'sticker':
      // Stickers are images under the hood. Treat them as such so the
      // MessageBubble renders the <img>. The caller maps the DB
      // content_type to 'image' for the CHECK constraint.
      if (message.sticker?.id) {
        return {
          ...empty,
          mediaUrl: await verifyAndBuildUrl(message.sticker.id),
          mediaType: message.sticker.mime_type,
        }
      }
      return empty

    case 'location':
      if (message.location) {
        const loc = message.location
        const locationText = [loc.name, loc.address, `${loc.latitude},${loc.longitude}`]
          .filter(Boolean)
          .join(' - ')
        return { ...empty, contentText: locationText }
      }
      return empty

    case 'reaction':
      return { ...empty, contentText: message.reaction?.emoji || null }

    case 'interactive': {
      // The customer tapped a reply button or a list row on a message
      // we previously sent. Meta delivers `interactive.button_reply` for
      // 3-button messages and `interactive.list_reply` for list messages.
      // Use the human-readable title as contentText so the inbox bubble
      // renders the tap legibly ("Existing customer"), and stash the
      // stable id separately so the Flows engine can route on it.
      const reply =
        message.interactive?.button_reply ?? message.interactive?.list_reply
      if (reply?.id) {
        return {
          ...empty,
          contentText: reply.title || reply.id,
          interactiveReplyId: reply.id,
        }
      }
      return { ...empty, contentText: '[Interactive reply]' }
    }

    default:
      return {
        ...empty,
        contentText: `[Unsupported message type: ${message.type}]`,
      }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContactRow = any

interface ContactOutcome {
  contact: ContactRow
  /** True when this call created the row; drives new_contact_created
   *  automation dispatch in processMessage. */
  wasCreated: boolean
}

async function findOrCreateContact(
  accountId: string,
  configOwnerUserId: string,
  phone: string,
  name: string
): Promise<ContactOutcome | null> {
  // Look up existing contacts for this account. We pre-filter in SQL
  // by the phone's last-8-digit suffix so we don't ship every contact
  // in the account over the wire just to JS-filter to one row. This
  // matters at scale: a shared account with 5 teammates × 100 contacts
  // each is 500 rows — the prior implementation pulled all of them on
  // every inbound message.
  //
  // The `phonesMatch` helper considers two phones equal if they share
  // the last 8 digits (trunk-prefix tolerance). We mirror that here as
  // a `like` pattern, then re-run the strict comparison in JS on the
  // narrowed candidate set. The candidate set is typically 0-2 rows,
  // so the JS pass is effectively free.
  //
  // The trailing-suffix `like` cannot use a B-tree index, but the
  // `account_id` filter on top of `idx_contacts_account` (017) means
  // we sequential-scan a small, account-scoped subset.
  const normalizedSender = phone.replace(/\D/g, '')
  const phoneSuffix =
    normalizedSender.length >= 8
      ? normalizedSender.slice(-8)
      : normalizedSender

  const { data: contacts, error: contactsError } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .like('phone', `%${phoneSuffix}`)

  if (contactsError) {
    console.error('Error fetching contacts:', contactsError)
    return null
  }

  // Re-apply phonesMatch on the candidate set for correctness — the
  // SQL `like` is a coarse pre-filter; phonesMatch handles edge cases
  // like leading-`+` and explicit trunk-zero handling.
  const existingContact = contacts?.find((c: ContactRow) => phonesMatch(c.phone, phone))

  if (existingContact) {
    // Update name if it changed
    if (name && name !== existingContact.name) {
      await supabaseAdmin()
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id)
    }
    return { contact: existingContact, wasCreated: false }
  }

  // Create new contact. account_id is the tenancy column;
  // user_id is the NOT NULL FK audit column (no inbound message
  // has a single "user who created" it — we attribute to the
  // WhatsApp config owner as a stable default).
  const { data: newContact, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      phone,
      name: name || phone,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating contact:', createError)
    return null
  }

  return { contact: newContact, wasCreated: true }
}

async function findOrCreateConversation(
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
) {
  // Look for existing conversation in this account
  const { data: existing, error: findError } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .maybeSingle()

  if (findError) {
    console.error('Error fetching conversations:', findError)
    return null
  }
  if (existing) return existing

  // Create new conversation. Same tenancy + audit split as
  // findOrCreateContact above.
  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      contact_id: contactId,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating conversation:', createError)
    return null
  }

  return newConv
}
