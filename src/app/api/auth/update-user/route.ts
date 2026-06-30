import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/mysql';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'wacrm-secret-default-encryption-key-32-chars';

export async function POST(request: Request) {
  try {
    const cookiesHeader = request.headers.get('cookie') || '';
    const sessionCookie = cookiesHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('wacrm_session='));

    if (!sessionCookie) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const token = sessionCookie.split('=')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: { message: 'Invalid session' } }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password || password.length < 6) {
      return NextResponse.json({ error: { message: 'Password must be at least 6 characters' } }, { status: 400 });
    }

    const hash = bcrypt.hashSync(password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, decoded.userId]);

    return NextResponse.json({ data: { user: { id: decoded.userId, email: decoded.email } }, error: null });
  } catch (err: any) {
    console.error('[POST /api/auth/update-user] unexpected error:', err);
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
