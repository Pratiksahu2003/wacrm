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
function toBytes(rawBody: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (typeof rawBody === 'string') return new TextEncoder().encode(rawBody)
  if (rawBody instanceof Uint8Array) return rawBody
  return new Uint8Array(rawBody)
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function parseSignatureHeader(signatureHeader: string): {
  algo: 'SHA-256' | 'SHA-1'
  hex: string
  prefix: 'sha256=' | 'sha1='
} | null {
  if (signatureHeader.startsWith('sha256=')) {
    return {
      algo: 'SHA-256',
      hex: signatureHeader.slice('sha256='.length),
      prefix: 'sha256=',
    }
  }
  if (signatureHeader.startsWith('sha1=')) {
    return {
      algo: 'SHA-1',
      hex: signatureHeader.slice('sha1='.length),
      prefix: 'sha1=',
    }
  }
  return null
}

async function hmacHex(
  secret: string,
  message: Uint8Array,
  hash: 'SHA-256' | 'SHA-1',
): Promise<string> {
  const body = new Uint8Array(message.byteLength)
  body.set(message)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: { name: hash } },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, body)
  return bytesToHex(new Uint8Array(sig))
}

export async function verifyMetaWebhookSignature(
  rawBody: string | ArrayBuffer | Uint8Array,
  signatureHeader: string | null,
  secrets?: string[],
): Promise<boolean> {
  const candidates = (
    secrets ??
    (process.env.META_APP_SECRET ? [process.env.META_APP_SECRET] : [])
  )
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (candidates.length === 0) {
    console.error(
      '[webhook] No Meta App Secret configured — rejecting request. ' +
        'Add your App Secret in Settings → WhatsApp Config, or set ' +
        'META_APP_SECRET in the environment.',
    )
    return false
  }

  if (!signatureHeader) return false
  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) return false

  const message = toBytes(rawBody)
  for (const secret of candidates) {
    const digestHex = await hmacHex(secret, message, parsed.algo)
    const expected = parsed.prefix + digestHex
    if (constantTimeEqualHex(signatureHeader, expected)) return true
  }

  return false
}
