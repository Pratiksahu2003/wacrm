import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import { sendTemplateBatch } from '@/lib/broadcasts/send-batch'
import type { BroadcastSendRecipient } from '@/lib/broadcasts/types'

interface BroadcastResult {
  phone: string
  status: 'sent' | 'failed'
  whatsapp_message_id?: string
  error?: string
}

/**
 * Send a batch of template messages (used by legacy callers). New
 * broadcasts should use POST /api/broadcasts/start which queues and
 * processes in the background.
 */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
      broadcast_id,
    } = body

    const rateKey = broadcast_id
      ? `broadcast-batch:${user.id}`
      : `broadcast-start:${user.id}`
    const rateBudget = broadcast_id
      ? RATE_LIMITS.broadcastBatch
      : RATE_LIMITS.broadcast
    const limit = checkRateLimit(rateKey, rateBudget)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

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

    let recipients: BroadcastSendRecipient[]
    if (Array.isArray(newRecipients) && newRecipients.length > 0) {
      recipients = newRecipients
    } else if (Array.isArray(phone_numbers) && phone_numbers.length > 0) {
      const shared: string[] = Array.isArray(template_params)
        ? template_params
        : []
      recipients = phone_numbers.map((phone: string) => ({
        phone,
        params: shared,
      }))
    } else {
      return NextResponse.json(
        {
          error:
            'Provide either `recipients` (preferred) or `phone_numbers` — must be a non-empty array',
        },
        { status: 400 },
      )
    }

    if (!template_name) {
      return NextResponse.json(
        { error: 'template_name is required' },
        { status: 400 },
      )
    }

    const results: BroadcastResult[] = await sendTemplateBatch({
      supabase,
      accountId,
      templateName: template_name,
      templateLanguage: template_language,
      recipients,
    })

    const sentCount = results.filter((r) => r.status === 'sent').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results,
    })
  } catch (error) {
    console.error('Error in WhatsApp broadcast POST:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process broadcast',
      },
      { status: 500 },
    )
  }
}
