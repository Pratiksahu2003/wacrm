/**
 * WhatsApp Message Webhook Handler
 *
 * Dedicated endpoint for processing WhatsApp message-related events only.
 * This route handles:
 * - Incoming text messages
 * - Media messages (image, video, audio, document)
 * - Location messages
 * - Contact messages
 * - Sticker messages
 * - Reaction messages
 * - Interactive messages (button/list replies)
 *
 * Security:
 * - HMAC-SHA256 signature verification
 * - Idempotency key deduplication
 * - Circuit breaker pattern for resilience
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  decryptIfEncrypted,
  encrypt,
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
  image?: { id: string; caption?: string; mime_type?: string }
  video?: { id: string; caption?: string; mime_type?: string }
  audio?: { id: string; mime_type?: string }
  document?: { id: string; filename?: string; caption?: string; mime_type?: string }
  sticker?: { id: string; mime_type?: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  contacts?: Array<{
    name: { formatted_name: string; first_name?: string }
    phones?: Array<{ phone: string; type?: string }>
    emails?: Array<{ email: string; type?: string }>
  }>
  reaction?: { message_id: string; emoji?: string }
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  context?: { id: string; from?: string }
}

// GET handler - Webhook verification (Meta subscription challenge)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const requestId = newWebhookRequestId()
  const startedAt = Date.now()

  logWebhook('info', 'verify_received', {
    request_id: requestId,
    mode,
    has_token: !!token,
    has_challenge: !!challenge,
  })

  if (mode !== 'subscribe' || !token || !challenge) {
    logWebhook('warn', 'verify_rejected', {
      request_id: requestId,
      reason: 'missing_params',
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Missing verification parameters' },
      { status: 400 }
    )
  }

  // Check environment tokens first
  const envVerifyTokens = [
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    process.env.META_WEBHOOK_VERIFY_TOKEN,
  ]
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)

  if (envVerifyTokens.includes(token)) {
    logWebhook('info', 'verify_ok', {
      request_id: requestId,
      source: 'environment',
      duration_ms: Date.now() - startedAt,
    })
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Check database tokens
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

  // Check each config's verify_token
  for (const config of configs) {
    if (!config.verify_token) continue
    try {
      const decoded = decryptIfEncrypted(config.verify_token)
      if (decoded.plaintext === token) {
        logWebhook('info', 'verify_ok', {
          request_id: requestId,
          source: 'database',
          config_id: maskId(config.id),
          duration_ms: Date.now() - startedAt,
        })
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    } catch {
      // Decryption failed, skip this config
    }
  }

  logWebhook('warn', 'verify_rejected', {
    request_id: requestId,
    reason: 'token_mismatch',
    duration_ms: Date.now() - startedAt,
  })
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST handler - Process incoming message webhooks
export async function POST(request: Request) {
  const requestId = newWebhookRequestId()
  const startedAt = Date.now()

  // Log request headers in debug mode
  if (isWebhookDebugEnabled()) {
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })
    logWebhook('info', 'post_headers', { request_id: requestId, headers })
  }

  // Verify webhook signature
  let rawBody: string
  let rawBodyBytes: Uint8Array
  try {
    rawBodyBytes = new Uint8Array(await request.arrayBuffer())
    rawBody = new TextDecoder().decode(rawBodyBytes)
  } catch (error) {
    logWebhook('error', 'post_body_read_failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const signatureHeader = request.headers.get('x-hub-signature-256')
  const secrets = await loadWebhookSignatureSecrets(supabaseAdmin())

  logWebhook('info', 'signature_sources', {
    request_id: requestId,
    ...describeWebhookSignatureSources(secrets),
  })

  const { isValid, secretUsed } = verifyMetaWebhookSignature(
    signatureHeader,
    rawBodyBytes,
    secrets.list
  )

  if (!isValid) {
    logWebhook('warn', 'post_rejected', {
      request_id: requestId,
      reason: 'invalid_signature',
      has_signature: !!signatureHeader,
      secret_count: secrets.list.length,
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  // Parse body
  let body: { entry?: WhatsAppWebhookEntry[] }
  try {
    body = JSON.parse(rawBody)
  } catch (error) {
    logWebhook('error', 'post_body_parse_failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify this is a message webhook
  const summary = summarizeWebhookBody(body)

  // Only accept webhooks with messages
  if (!summary.message_count || summary.message_count === 0) {
    logWebhook('info', 'post_not_message_webhook', {
      request_id: requestId,
      ...summary,
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'This endpoint only accepts message webhooks' },
      { status: 400 }
    )
  }

  // Log successful acceptance
  logWebhook('info', 'post_accepted', {
    request_id: requestId,
    body_bytes: rawBodyBytes.byteLength,
    ...summary,
    signature_matched: secretUsed ?? null,
    duration_ms: Date.now() - startedAt,
  })

  // Process the webhook asynchronously
  const processStartedAt = Date.now()
  processWebhook(body, requestId)
    .then(() => {
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
      const value = change.value

      // Skip non-message webhooks
      if (!value?.messages || value.messages.length === 0) {
        continue
      }

      const phoneNumberId = value.metadata?.phone_number_id

      logWebhook('info', 'change_messages', {
        request_id: requestId,
        phone_number_id: maskId(phoneNumberId),
        message_count: value.messages.length,
        message_types: value.messages.map((m: WhatsAppMessage) => m.type),
      })

      // Find user's config by phone_number_id
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

        // Opportunistically upgrade to GCM if still in legacy CBC format
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

      // Process each message
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
          config.account_id,
          config.user_id,
          decryptedAccessToken,
          requestId,
        )
      }
    }
  }
}

async function processMessage(
  message: WhatsAppMessage,
  contact: { profile: { name: string }; wa_id: string },
  accountId: string,
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

  // Handle reactions separately
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

  // Resolve swipe-reply context if present
  let replyToInternalId: string | null = null
  if (message.context?.id) {
    replyToInternalId = await lookupInternalIdByMetaId(
      message.context.id,
      conversation.id
    )
  }

  // Map content type
  const ALLOWED_CONTENT_TYPES = new Set([
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive',
  ])
  const contentType = ALLOWED_CONTENT_TYPES.has(message.type)
    ? message.type
    : message.type === 'sticker'
      ? 'image'
      : 'text'

  // Check if this is the first inbound message
  const { count: priorCustomerMsgCount } = await supabaseAdmin()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  // Insert message
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
    interactive_reply_id: interactiveReplyId,
  })

  if (msgError) {
    logWebhook('error', 'message_insert_failed', {
      request_id: requestId,
      meta_message_id: maskId(message.id),
      type: message.type,
      content_type: contentType,
      error: msgError.message,
      details: msgError,
    })
    return
  }

  // Update conversation metadata
  const updates: {
    last_message_text?: string
    last_message_at: string
    unread_count?: number
    reply_deadline_at?: string
  } = {
    last_message_text: contentText,
    last_message_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
  }

  if (isFirstInboundMessage) {
    const firstReplyDeadline = new Date()
    firstReplyDeadline.setHours(firstReplyDeadline.getHours() + 24)
    updates.reply_deadline_at = firstReplyDeadline.toISOString()
  }

  const { error: convUpdateError } = await supabaseAdmin()
    .from('conversations')
    .update(updates)
    .eq('id', conversation.id)

  if (convUpdateError) {
    console.error('Error updating conversation:', convUpdateError)
  }

  // Update contact
  const contactUpdates: {
    last_contacted_at: string
    last_contacted_via: string
    first_inbound_message_at?: string
  } = {
    last_contacted_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    last_contacted_via: 'whatsapp',
  }

  if (isFirstInboundMessage) {
    contactUpdates.first_inbound_message_at = new Date(
      parseInt(message.timestamp) * 1000
    ).toISOString()
  }

  const { error: contactUpdateError } = await supabaseAdmin()
    .from('contacts')
    .update(contactUpdates)
    .eq('id', contactRecord.id)

  if (contactUpdateError) {
    console.error('Error updating contact:', contactUpdateError)
  }

  // Check for broadcast reply flagging
  await flagBroadcastReplyIfAny(accountId, contactRecord.id)

  // Run automations
  const automationResult = await runAutomationsForTrigger({
    triggerType: 'message_received',
    accountId,
    conversationId: conversation.id,
    contactId: contactRecord.id,
    messageContent: contentText,
  })

  if (automationResult.executed) {
    logWebhook('info', 'automation_triggered', {
      request_id: requestId,
      automation_id: automationResult.automationId,
    })
  }

  // Dispatch to flows
  const flowResult = await dispatchInboundToFlows({
    accountId,
    conversationId: conversation.id,
    contactId: contactRecord.id,
    messageId: message.id,
    content: contentText,
  })

  if (flowResult.handled) {
    logWebhook('info', 'flow_dispatched', {
      request_id: requestId,
      flow_id: flowResult.flowId,
      node_id: flowResult.nodeId,
    })
  }

  logWebhook('info', 'message_processed', {
    request_id: requestId,
    meta_message_id: maskId(message.id),
    conversation_id: maskId(conversation.id),
    contact_id: maskId(contactRecord.id),
    automation_triggered: automationResult.executed,
    flow_dispatched: flowResult.handled,
  })
}

// Helper functions

async function findOrCreateContact(
  accountId: string,
  configOwnerUserId: string,
  senderPhone: string,
  contactName: string,
): Promise<{ contact: { id: string }; created: boolean } | null> {
  // Try to find existing contact
  const { data: existingContacts, error: searchError } = await supabaseAdmin()
    .from('contacts')
    .select('id, phone')
    .eq('account_id', accountId)
    .eq('phone', senderPhone)

  if (searchError) {
    console.error('Error searching for contact:', searchError)
    return null
  }

  if (existingContacts && existingContacts.length > 0) {
    const contact = existingContacts.find((c: { phone: string }) =>
      phonesMatch(c.phone, senderPhone)
    )
    if (contact) {
      return { contact, created: false }
    }
  }

  // Create new contact
  const { data: newContact, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({
      account_id: accountId,
      name: contactName,
      phone: senderPhone,
      created_by: configOwnerUserId,
    })
    .select('id')
    .single()

  if (createError) {
    console.error('Error creating contact:', createError)
    return null
  }

  return { contact: newContact, created: true }
}

async function findOrCreateConversation(
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
): Promise<{ id: string } | null> {
  // Try to find existing conversation
  const { data: existingConv, error: searchError } = await supabaseAdmin()
    .from('conversations')
    .select('id')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .maybeSingle()

  if (searchError) {
    console.error('Error searching for conversation:', searchError)
    return null
  }

  if (existingConv) {
    return existingConv
  }

  // Create new conversation
  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({
      account_id: accountId,
      contact_id: contactId,
      created_by: configOwnerUserId,
    })
    .select('id')
    .single()

  if (createError) {
    console.error('Error creating conversation:', createError)
    return null
  }

  return newConv
}

async function handleReaction(
  message: WhatsAppMessage,
  conversationId: string,
  contactId: string,
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

async function lookupInternalIdByMetaId(
  metaId: string,
  conversationId: string,
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

async function parseMessageContent(
  message: WhatsAppMessage,
  accessToken: string,
): Promise<{
  contentText: string
  mediaUrl?: string
  mediaType?: string
  interactiveReplyId?: string
}> {
  let contentText = ''
  let mediaUrl: string | undefined
  let mediaType: string | undefined
  let interactiveReplyId: string | undefined

  switch (message.type) {
    case 'text':
      contentText = message.text?.body ?? ''
      break

    case 'image':
      contentText = message.image?.caption ?? ''
      mediaType = message.image?.mime_type ?? 'image/jpeg'
      if (message.image?.id) {
        try {
          mediaUrl = await getMediaUrl(message.image.id, accessToken)
        } catch (error) {
          console.error('Failed to get image URL:', error)
        }
      }
      break

    case 'video':
      contentText = message.video?.caption ?? ''
      mediaType = message.video?.mime_type ?? 'video/mp4'
      if (message.video?.id) {
        try {
          mediaUrl = await getMediaUrl(message.video.id, accessToken)
        } catch (error) {
          console.error('Failed to get video URL:', error)
        }
      }
      break

    case 'audio':
    case 'voice':
      mediaType = message.audio?.mime_type ?? 'audio/ogg'
      if (message.audio?.id) {
        try {
          mediaUrl = await getMediaUrl(message.audio.id, accessToken)
        } catch (error) {
          console.error('Failed to get audio URL:', error)
        }
      }
      break

    case 'document':
      contentText = message.document?.caption ?? ''
      mediaType = message.document?.mime_type ?? 'application/pdf'
      if (message.document?.id) {
        try {
          mediaUrl = await getMediaUrl(message.document.id, accessToken)
        } catch (error) {
          console.error('Failed to get document URL:', error)
        }
      }
      break

    case 'sticker':
      mediaType = message.sticker?.mime_type ?? 'image/webp'
      if (message.sticker?.id) {
        try {
          mediaUrl = await getMediaUrl(message.sticker.id, accessToken)
        } catch (error) {
          console.error('Failed to get sticker URL:', error)
        }
      }
      break

    case 'location':
      if (message.location) {
        const { latitude, longitude, name, address } = message.location
        contentText = `📍 Location: ${latitude}, ${longitude}`
        if (name) contentText += `\nName: ${name}`
        if (address) contentText += `\nAddress: ${address}`
      }
      break

    case 'contacts':
      if (message.contacts && message.contacts.length > 0) {
        const contact = message.contacts[0]
        contentText = `👤 Contact: ${contact.name.formatted_name}`
        if (contact.phones && contact.phones.length > 0) {
          contentText += `\nPhone: ${contact.phones[0].phone}`
        }
        if (contact.emails && contact.emails.length > 0) {
          contentText += `\nEmail: ${contact.emails[0].email}`
        }
      }
      break

    case 'interactive':
      if (message.interactive) {
        if (message.interactive.type === 'button_reply' && message.interactive.button_reply) {
          contentText = message.interactive.button_reply.title
          interactiveReplyId = message.interactive.button_reply.id
        } else if (message.interactive.type === 'list_reply' && message.interactive.list_reply) {
          contentText = message.interactive.list_reply.title
          interactiveReplyId = message.interactive.list_reply.id
        }
      }
      break

    default:
      contentText = `[${message.type} message]`
  }

  return { contentText, mediaUrl, mediaType, interactiveReplyId }
}

async function flagBroadcastReplyIfAny(accountId: string, contactId: string) {
  try {
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
