import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, transaction } from '@/lib/mysql';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'VedMint Crm-secret-default-encryption-key-32-chars';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password;
    
    // Support both direct client form field and options structure from emulator client
    const fullName = (body.fullName || body.options?.data?.full_name || '').trim();

    if (!email || !password) {
      return NextResponse.json({ error: { message: 'Email and password are required' } }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: { message: 'Password must be at least 6 characters' } }, { status: 400 });
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return NextResponse.json({ error: { message: 'User already exists' } }, { status: 400 });
    }

    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 10);

    // Bootstrap user, account, and profile inside transaction
    await transaction(async (conn) => {
      await conn.query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, email, hash]);
      await conn.query('INSERT INTO accounts (id, name, owner_user_id) VALUES (?, ?, ?)', [accountId, fullName || email, userId]);
      await conn.query('INSERT INTO profiles (id, user_id, full_name, email, account_id, account_role) VALUES (?, ?, ?, ?, ?, ?)', [
        profileId, userId, fullName, email, accountId, 'owner'
      ]);
    });

    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
    const user = { id: userId, email };
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
    console.error('[POST /api/auth/signup] unexpected error:', err);
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
