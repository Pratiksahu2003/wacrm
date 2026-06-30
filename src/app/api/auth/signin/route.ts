import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '@/lib/mysql';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'VedMint Crm-secret-default-encryption-key-32-chars';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: { message: 'Email and password are required' } }, { status: 400 });
    }

    const dbUsers = await query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    const dbUser = dbUsers[0];

    if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
      return NextResponse.json({ error: { message: 'Invalid credentials' } }, { status: 400 });
    }

    const token = jwt.sign({ userId: dbUser.id, email: dbUser.email }, JWT_SECRET, { expiresIn: '7d' });
    const user = { id: dbUser.id, email: dbUser.email };
    const session = { user, access_token: token };

    const response = NextResponse.json({ data: { user, session }, error: null });

    // Set HTTP-only cookie
    response.cookies.set('vedmint_crm_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('[POST /api/auth/signin] unexpected error:', err);
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
