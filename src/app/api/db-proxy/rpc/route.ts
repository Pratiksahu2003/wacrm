import { NextResponse } from 'next/server';
import { executeRpc } from '@/lib/supabase/rpc-handlers';
import { sessionUserFromRequest } from '@/lib/session-token';

export async function POST(request: Request) {
  try {
    const sessionUser = await sessionUserFromRequest(request);

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fnName, args } = await request.json();
    const result = await executeRpc(fnName, args, sessionUser.id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/db-proxy/rpc] unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
