import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { startFlowForContact } from '@/lib/flows/engine'
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
} from '@/lib/vedmint-subscription/server'

/**
 * POST /api/flows/[id]/start — manually start an active flow for a contact.
 *
 * Used for manual-trigger flows and to re-run a welcome flow after a
 * failed run without waiting for the customer to message again.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: startProfile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .maybeSingle()
  const startAccountId = startProfile?.account_id as string | undefined
  if (startAccountId) {
    try {
      await assertCanPerform(user.id, startAccountId, 'flows')
    } catch (err) {
      if (err instanceof PlanGateError) return planGateResponse(err)
      throw err
    }
  }

  const { data: owned } = await supabase
    .from('flows')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!owned) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as {
    contact_id?: string
  } | null
  const contactId = body?.contact_id?.trim()
  if (!contactId) {
    return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: flow, error: flowErr } = await admin
    .from('flows')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (flowErr || !flow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (flow.status !== 'active') {
    return NextResponse.json(
      { error: 'Flow must be active to start' },
      { status: 400 },
    )
  }
  if (!flow.entry_node_id) {
    return NextResponse.json(
      { error: 'Flow has no entry node' },
      { status: 400 },
    )
  }

  const { data: contact } = await admin
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('account_id', flow.account_id)
    .maybeSingle()
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const { data: conversation } = await admin
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('account_id', flow.account_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!conversation) {
    return NextResponse.json(
      { error: 'No conversation exists for this contact' },
      { status: 400 },
    )
  }

  const result = await startFlowForContact({
    accountId: flow.account_id,
    flowId: flow.id,
    contactId,
    conversationId: conversation.id,
    userId: user.id,
  })

  if (!result.consumed && result.flow_run_id) {
    return NextResponse.json(
      { error: 'Contact already has an active flow run', flow_run_id: result.flow_run_id },
      { status: 409 },
    )
  }
  if (!result.consumed) {
    return NextResponse.json({ error: 'Could not start flow' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    flow_run_id: result.flow_run_id,
    outcome: result.outcome,
  })
}
