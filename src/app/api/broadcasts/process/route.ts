import { NextResponse } from 'next/server';
import { getBroadcastInternalSecret } from '@/lib/broadcasts/trigger';
import { processBroadcast } from '@/lib/broadcasts/processor';

export const runtime = 'nodejs';
/** Allow long sends per invocation; processor re-triggers if needed. */
export const maxDuration = 300;

/**
 * Runs the broadcast processor. Invoked automatically by
 * /api/broadcasts/start — operators do not call this manually.
 */
export async function POST(request: Request) {
  const expected = getBroadcastInternalSecret();
  if (!expected) {
    return NextResponse.json(
      { error: 'Broadcast processor not configured' },
      { status: 503 },
    );
  }

  const supplied = request.headers.get('x-cron-secret') ?? '';
  if (supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let broadcastId: string | undefined;
  try {
    const body = (await request.json()) as { broadcast_id?: string };
    broadcastId = body.broadcast_id;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!broadcastId) {
    return NextResponse.json(
      { error: 'broadcast_id is required' },
      { status: 400 },
    );
  }

  try {
    await processBroadcast(broadcastId);
    return NextResponse.json({ ok: true, broadcast_id: broadcastId });
  } catch (err) {
    console.error(`[broadcasts/process] error for ${broadcastId}:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Broadcast processing failed',
      },
      { status: 500 },
    );
  }
}
