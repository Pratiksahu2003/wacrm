import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptIfEncrypted, encrypt } from '@/lib/whatsapp/encryption'
import {
  deleteMessageTemplate,
  editMessageTemplate,
} from '@/lib/whatsapp/meta-api'
import {
  validateTemplatePayload,
  type TemplatePayload,
} from '@/lib/whatsapp/template-validators'
import { buildMetaTemplatePayload } from '@/lib/whatsapp/template-components'
import { metaApiErrorStatus } from '@/lib/whatsapp/meta-api-errors'
import { prepareTemplatePayloadForMetaSubmit } from '@/lib/whatsapp/template-header-upload'

export const runtime = 'nodejs'

/**
 * Per-template lifecycle endpoint.
 *
 * PATCH  — edit an existing Meta-side template (and re-submit). Used
 *          by the "Edit" action on APPROVED rows and the "Resubmit"
 *          action on REJECTED / PAUSED rows. Meta replaces components
 *          wholesale on edit and bumps status back to PENDING.
 *
 * DELETE — remove the template on Meta (when meta_template_id is set,
 *          scoped to a single language variant via hsm_id) AND drop
 *          the local row. Local-only rows skip the Meta call.
 *
 * Initial submission (DRAFT → PENDING) lives at the sibling
 * /submit endpoint — keep this route narrowly about lifecycle of
 * already-submitted templates.
 */

const EDITABLE_STATUSES = new Set(['APPROVED', 'REJECTED', 'PAUSED'])

// uuid v4 plus the looser shape Postgres gen_random_uuid emits.
// We don't need exhaustive RFC parsing — just enough to reject
// "../etc/passwd"-style payloads before they hit Supabase.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isDryRun(): boolean {
  return (
    process.env.WHATSAPP_TEMPLATES_DRY_RUN === 'true' ||
    process.env.WHATSAPP_TEMPLATES_DRY_RUN === '1'
  )
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: 'Invalid template id.' },
        { status: 400 },
      )
    }
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve the caller's account_id so template + whatsapp_config
    // lookups work for teammates who didn't author the row.
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    let payload: TemplatePayload
    try {
      payload = (await request.json()) as TemplatePayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    // RLS handles ownership, but we need the existing row to read
    // meta_template_id and status — fetch explicitly.
    const { data: existing, error: lookupErr } = await supabase
      .from('message_templates')
      .select(
        'id, name, status, meta_template_id, language, header_type, header_handle, header_media_url, category',
      )
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle()
    if (lookupErr || !existing) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
    }

    if (!existing.meta_template_id) {
      return NextResponse.json(
        {
          error:
            'This template was never submitted to Meta — use New Template to submit it instead.',
        },
        { status: 400 },
      )
    }

    if (!EDITABLE_STATUSES.has(existing.status)) {
      return NextResponse.json(
        {
          error: `Templates in status ${existing.status} cannot be edited. Allowed: APPROVED, REJECTED, PAUSED.`,
        },
        { status: 400 },
      )
    }

    if (payload.category === 'Authentication') {
      return NextResponse.json(
        {
          error:
            'AUTHENTICATION templates are not editable here — manage them in Meta WhatsApp Manager.',
        },
        { status: 400 },
      )
    }

    try {
      validateTemplatePayload(payload)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Validation failed.' },
        { status: 400 },
      )
    }

    let submitPayload: TemplatePayload = payload

    if (!isDryRun()) {
      const { fetchAccountWhatsAppConfig } = await import(
        '@/lib/whatsapp/resolve-config'
      )
      const { data: config, error: configError } = await fetchAccountWhatsAppConfig(
        supabase,
        accountId,
      )
      if (configError || !config) {
        return NextResponse.json(
          { error: 'WhatsApp not configured.' },
          { status: 400 },
        )
      }
      const decodedToken = decryptIfEncrypted(config.access_token)
      const accessToken = decodedToken.plaintext
      if (!decodedToken.encrypted || decodedToken.legacy) {
        void supabase
          .from('whatsapp_config')
          .update({ access_token: encrypt(accessToken) })
          .eq('id', config.id)
      }

      try {
        submitPayload = await prepareTemplatePayloadForMetaSubmit(
          payload,
          accessToken,
          {
            existingHeaderHandle: existing.header_handle,
            existingHeaderMediaUrl: existing.header_media_url,
            metaTemplateId: existing.meta_template_id,
          },
        )
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to upload header media.'
        return NextResponse.json(
          { error: message },
          { status: metaApiErrorStatus(message) },
        )
      }

      let metaPayload
      try {
        metaPayload = buildMetaTemplatePayload(submitPayload)
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Invalid template payload.'
        return NextResponse.json({ error: message }, { status: 400 })
      }

      try {
        await editMessageTemplate({
          metaTemplateId: existing.meta_template_id,
          accessToken,
          components: metaPayload.components,
          category:
            submitPayload.category !== existing.category
              ? metaPayload.category
              : undefined,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Meta edit failed.'
        await supabase
          .from('message_templates')
          .update({
            submission_error: message,
            last_submitted_at: new Date().toISOString(),
          })
          .eq('id', id)
        return NextResponse.json({ error: message }, { status: metaApiErrorStatus(message) })
      }
    } else if (
      payload.header_type &&
      payload.header_type !== 'text' &&
      payload.header_media_url &&
      !payload.header_handle
    ) {
      submitPayload = { ...payload, header_handle: 'dry-run-handle' }
    }

    // Meta accepted the edit — status flips back to PENDING for review.
    const { data: row, error: updErr } = await supabase
      .from('message_templates')
      .update({
        category: submitPayload.category,
        header_type: submitPayload.header_type ?? null,
        header_content: submitPayload.header_content ?? null,
        header_media_url: submitPayload.header_media_url ?? null,
        header_handle: submitPayload.header_handle ?? null,
        body_text: submitPayload.body_text,
        footer_text: submitPayload.footer_text ?? null,
        buttons: submitPayload.buttons ?? null,
        sample_values: submitPayload.sample_values ?? null,
        status: 'PENDING',
        submission_error: null,
        rejection_reason: null,
        last_submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updErr) {
      return NextResponse.json(
        {
          error: `Edited on Meta but failed to save locally: ${updErr.message}. Run "Sync from Meta" to recover.`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      template: row,
      dry_run: isDryRun(),
    })
  } catch (error) {
    console.error('Error editing template:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to edit template.',
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: 'Invalid template id.' },
        { status: 400 },
      )
    }
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Same account-scoping rationale as the PATCH handler above —
    // teammates need to be able to operate on shared templates +
    // the shared whatsapp_config.
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const { data: existing, error: lookupErr } = await supabase
      .from('message_templates')
      .select('id, name, meta_template_id')
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle()
    if (lookupErr || !existing) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
    }

    if (existing.meta_template_id && !isDryRun()) {
      const { fetchAccountWhatsAppConfig } = await import(
        '@/lib/whatsapp/resolve-config'
      )
      const { data: config, error: configError } = await fetchAccountWhatsAppConfig(
        supabase,
        accountId,
      )
      if (configError || !config || !config.waba_id) {
        return NextResponse.json(
          { error: 'WhatsApp not configured — cannot delete on Meta.' },
          { status: 400 },
        )
      }
      const decodedToken = decryptIfEncrypted(config.access_token)
      const accessToken = decodedToken.plaintext
      if (!decodedToken.encrypted || decodedToken.legacy) {
        void supabase
          .from('whatsapp_config')
          .update({ access_token: encrypt(accessToken) })
          .eq('id', config.id)
      }
      try {
        await deleteMessageTemplate({
          wabaId: config.waba_id,
          accessToken,
          name: existing.name,
          metaTemplateId: existing.meta_template_id,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Meta delete failed.'
        return NextResponse.json({ error: message }, { status: metaApiErrorStatus(message) })
      }
    }

    const { error: delErr } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id)
    if (delErr) {
      return NextResponse.json(
        {
          error: `Deleted on Meta but failed to delete locally: ${delErr.message}.`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, dry_run: isDryRun() })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete template.',
      },
      { status: 500 },
    )
  }
}
