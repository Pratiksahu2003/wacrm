import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { executeRpc } from '@/lib/supabase/rpc-handlers';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'VedMint Crm-secret-default-encryption-key-32-chars';

export async function POST(request: Request) {
  try {
    const cookiesHeader = request.headers.get('cookie') || '';
    const sessionCookie = cookiesHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('vedmint_crm_session='));

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = sessionCookie.split('=')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { fnName, args } = await request.json();
    const result = await executeRpc(fnName, args, decoded.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[POST /api/db-proxy/rpc] unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
