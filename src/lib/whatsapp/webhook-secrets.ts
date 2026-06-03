import { decrypt } from '@/lib/whatsapp/encryption'

/**
 * Collect every App Secret that may have signed an inbound webhook:
 * optional global env fallback plus each account's stored secret.
 */
export async function loadWebhookSignatureSecrets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: { from: (table: string) => any },
): Promise<string[]> {
  const secrets = new Set<string>()

  if (process.env.META_APP_SECRET) {
    secrets.add(process.env.META_APP_SECRET)
  }

  const { data: rows, error } = await adminClient
    .from('whatsapp_config')
    .select('meta_app_secret')
    .not('meta_app_secret', 'is', null)

  if (error) {
    console.error('[webhook] Failed to load meta_app_secret rows:', error)
  } else {
    for (const row of rows ?? []) {
      if (!row.meta_app_secret) continue
      try {
        secrets.add(decrypt(row.meta_app_secret))
      } catch {
        // Wrong key or corrupted row — skip so other tenants still verify.
      }
    }
  }

  return [...secrets]
}
