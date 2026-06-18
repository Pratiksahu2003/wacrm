import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { getBroadcastInternalSecret, triggerBroadcastProcessingHttp } from '@/lib/broadcasts/trigger';

/**
 * Resume stalled broadcasts (status = sending with pending recipients).
 * Optional safety net if the server restarts mid-send — broadcasts
 * also auto-start via /api/broadcasts/process when queued.
 */
export async function GET(request: Request) {
  const expected = getBroadcastInternalSecret();
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }

  const supplied = request.headers.get('x-cron-secret') ?? '';
  if (supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: stalled, error } = await admin
    .from('broadcasts')
    .select('id')
    .eq('status', 'sending')
    .order('updated_at', { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let resumed = 0;
  for (const row of stalled ?? []) {
    const { count } = await admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', row.id)
      .eq('status', 'pending');

    if ((count ?? 0) === 0) {
      const { count: failedCount } = await admin
        .from('broadcast_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', row.id)
        .eq('status', 'failed');
      const { count: totalCount } = await admin
        .from('broadcast_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', row.id);
      const finalStatus =
        (failedCount ?? 0) === (totalCount ?? 0) && (totalCount ?? 0) > 0
          ? 'failed'
          : 'sent';
      await admin
        .from('broadcasts')
        .update({ status: finalStatus })
        .eq('id', row.id);
      continue;
    }

    triggerBroadcastProcessingHttp(row.id);
    resumed++;
  }

  return NextResponse.json({ resumed, scanned: stalled?.length ?? 0 });
}
