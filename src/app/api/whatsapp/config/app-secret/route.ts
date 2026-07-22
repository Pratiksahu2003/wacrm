import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptIfEncrypted, encrypt } from '@/lib/whatsapp/encryption'

export const runtime = 'nodejs'

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

/**
 * GET /api/whatsapp/config/app-secret
 *
 * Whether this account has a stored Meta App Secret (no value returned).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ configured: false, has_config: false })
    }

    const { fetchAccountWhatsAppConfig } = await import(
      '@/lib/whatsapp/resolve-config'
    )
    const { data: config, error } = await fetchAccountWhatsAppConfig(
      supabase,
      accountId,
    )

    if (error) {
      console.error('[app-secret GET]', error)
      return NextResponse.json(
        { error: 'Failed to load configuration' },
        { status: 500 },
      )
    }

    let decryptable = false
    if (config?.meta_app_secret) {
      try {
        decryptIfEncrypted(config.meta_app_secret)
        decryptable = true
      } catch {
        decryptable = false
      }
    }

    return NextResponse.json({
      has_config: Boolean(config),
      configured: decryptable,
      corrupted: Boolean(config?.meta_app_secret) && !decryptable,
      // True when META_APP_SECRET is set on this server — webhooks
      // verify even if the account hasn't saved a secret in Settings.
      server_env_fallback: Boolean(process.env.META_APP_SECRET),
    })
  } catch (error) {
    console.error('[app-secret GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/whatsapp/config/app-secret
 *
 * Saves only the Meta App Secret for the account's whatsapp_config row.
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const secret =
      typeof body.meta_app_secret === 'string'
        ? body.meta_app_secret.trim()
        : ''

    if (!secret) {
      return NextResponse.json(
        { error: 'meta_app_secret is required' },
        { status: 400 },
      )
    }

    const { data: existing, error: fetchError } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('account_id', accountId)
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('[app-secret PUT] fetch:', fetchError)
      return NextResponse.json(
        { error: 'Failed to load configuration' },
        { status: 500 },
      )
    }

    if (!existing) {
      return NextResponse.json(
        {
          error:
            'Save your WhatsApp API credentials first, then add the App Secret here.',
        },
        { status: 400 },
      )
    }

    let encrypted: string
    try {
      encrypted = encrypt(secret)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown encryption error'
      console.error('[app-secret PUT] encrypt:', message)
      return NextResponse.json(
        {
          error:
            'Failed to encrypt secret. Check that ENCRYPTION_KEY is configured.',
        },
        { status: 500 },
      )
    }

    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update({
        meta_app_secret: encrypted,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)

    if (updateError) {
      console.error('[app-secret PUT] update:', updateError)
      return NextResponse.json(
        { error: 'Failed to save App Secret' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, configured: true })
  } catch (error) {
    console.error('[app-secret PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config/app-secret
 *
 * Clears the stored App Secret without touching other credentials.
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update({
        meta_app_secret: null,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId)

    if (updateError) {
      console.error('[app-secret DELETE]', updateError)
      return NextResponse.json(
        { error: 'Failed to clear App Secret' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, configured: false })
  } catch (error) {
    console.error('[app-secret DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
