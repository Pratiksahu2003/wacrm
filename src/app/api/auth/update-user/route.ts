import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/mysql';
import { sessionUserFromRequest } from '@/lib/session-token';

export async function POST(request: Request) {
  try {
    const sessionUser = await sessionUserFromRequest(request);

    if (!sessionUser) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password || password.length < 8) {
      return NextResponse.json({ error: { message: 'Password must be at least 8 characters' } }, { status: 400 });
    }

    const hash = bcrypt.hashSync(password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, sessionUser.id]);

    return NextResponse.json({ data: { user: sessionUser }, error: null });
  } catch (err: any) {
    console.error('[POST /api/auth/update-user] unexpected error:', err);
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
