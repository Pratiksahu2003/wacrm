import crypto from 'node:crypto'

/**
 * Verify the HMAC-SHA256 signature Meta attaches to webhook POSTs.
 *
 * Meta signs the raw request body with your App Secret and sends the
 * result in the `x-hub-signature-256: sha256=<hex>` header. Without
 * verification, anyone who knows our webhook URL can POST fabricated
 * status updates and drift broadcast counts arbitrarily.
 *
 * Reference:
 *   https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verify-payloads
 *
 * Contract:
 *   At least one secret must be supplied — typically the account's
 *   encrypted `meta_app_secret` from Settings and/or the optional
 *   `META_APP_SECRET` env fallback. If none are configured we fail
 *   closed.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secrets?: string[],
): boolean {
  const candidates = (
    secrets ??
    (process.env.META_APP_SECRET ? [process.env.META_APP_SECRET] : [])
  ).filter((s) => s.length > 0)

  if (candidates.length === 0) {
    console.error(
      '[webhook] No Meta App Secret configured — rejecting request. ' +
        'Add your App Secret in Settings → WhatsApp Config, or set ' +
        'META_APP_SECRET in the environment.',
    )
    return false
  }

  if (!signatureHeader) return false
  if (!signatureHeader.startsWith('sha256=')) return false

  for (const secret of candidates) {
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) continue
    if (crypto.timingSafeEqual(a, b)) return true
  }

  return false
}
