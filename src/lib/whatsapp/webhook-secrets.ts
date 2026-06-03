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

/** Counts for production logs — no secret values returned. */
export async function describeWebhookSignatureSources(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: { from: (table: string) => any },
): Promise<{
  env_secret_configured: boolean
  db_rows_with_secret: number
  db_secrets_decryptable: number
  db_secrets_decrypt_failed: number
  total_candidates: number
}> {
  let dbRows = 0
  let decryptOk = 0
  let decryptFailed = 0

  const { data: rows, error } = await adminClient
    .from('whatsapp_config')
    .select('meta_app_secret')
    .not('meta_app_secret', 'is', null)

  if (!error) {
    for (const row of rows ?? []) {
      if (!row.meta_app_secret) continue
      dbRows++
      try {
        decrypt(row.meta_app_secret)
        decryptOk++
      } catch {
        decryptFailed++
      }
    }
  }

  const envConfigured = Boolean(process.env.META_APP_SECRET?.trim())
  return {
    env_secret_configured: envConfigured,
    db_rows_with_secret: dbRows,
    db_secrets_decryptable: decryptOk,
    db_secrets_decrypt_failed: decryptFailed,
    total_candidates:
      (envConfigured ? 1 : 0) + decryptOk,
  }
}
