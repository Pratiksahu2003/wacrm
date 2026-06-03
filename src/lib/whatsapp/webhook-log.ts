import type { WhatsAppWebhookEntry } from '@/lib/whatsapp/webhook-types'

export type WebhookLogLevel = 'info' | 'warn' | 'error'

/**
 * Structured webhook logs for production (Hostinger, Vercel, etc.).
 * One JSON line per event — grep for `"scope":"whatsapp-webhook"`.
 *
 * Set WEBHOOK_DEBUG_LOG=true to include per-change field names and
 * message types. Never logs secrets, tokens, or message body text.
 */
export function logWebhook(
  level: WebhookLogLevel,
  event: string,
  data?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: 'whatsapp-webhook',
    event,
    ...data,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export function newWebhookRequestId(): string {
  return crypto.randomUUID().slice(0, 8)
}

export function isWebhookDebugEnabled(): boolean {
  const v = process.env.WEBHOOK_DEBUG_LOG?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** Last 4 chars only — enough to correlate without logging full numbers. */
export function maskId(id: string | undefined | null): string | null {
  if (!id) return null
  const s = String(id)
  if (s.length <= 4) return '****'
  return `…${s.slice(-4)}`
}

export function summarizeWebhookBody(body: {
  object?: string
  entry?: WhatsAppWebhookEntry[]
}): Record<string, unknown> {
  const entries = body.entry ?? []
  const changes = entries.flatMap((e) => e.changes ?? [])
  const fields = changes.map((c) => c.field)
  const phoneNumberIds = [
    ...new Set(
      changes
        .map((c) => c.value?.metadata?.phone_number_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const messageCount = changes.reduce(
    (n, c) => n + (c.value?.messages?.length ?? 0),
    0,
  )
  const statusCount = changes.reduce(
    (n, c) => n + (c.value?.statuses?.length ?? 0),
    0,
  )

  const summary: Record<string, unknown> = {
    object: body.object ?? null,
    entry_count: entries.length,
    change_count: changes.length,
    fields,
    phone_number_ids: phoneNumberIds.map((id) => maskId(id)),
    message_count: messageCount,
    status_count: statusCount,
  }

  if (isWebhookDebugEnabled()) {
    summary.message_types = changes.flatMap((c) =>
      (c.value?.messages ?? []).map((m) => m.type),
    )
  }

  return summary
}
