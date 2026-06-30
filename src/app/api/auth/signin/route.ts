import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/mysql';
import {
  createVerifiedSessionToken,
  isEmailVerifiedFlag,
  sendUserVerificationEmail,
  setSessionCookie,
  verificationEmailErrorMessage,
} from '@/lib/auth-verification';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: { message: 'Email and password are required' } }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const dbUsers = await query<{
      id: string;
      email: string;
      password_hash: string;
      email_verified?: number | boolean;
    }>('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    const dbUser = dbUsers[0];

    if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
      return NextResponse.json({ error: { message: 'Invalid credentials' } }, { status: 400 });
    }

    if (!isEmailVerifiedFlag(dbUser.email_verified)) {
      try {
        await sendUserVerificationEmail(dbUser.email);
      } catch (err) {
        console.error('[POST /api/auth/signin] verification email failed:', err);
        return NextResponse.json(
          {
            error: {
              message: verificationEmailErrorMessage(err),
              code: 'EMAIL_NOT_VERIFIED',
            },
            data: { needsVerification: true, email: dbUser.email },
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          error: {
            message:
              'Please verify your email before signing in. We sent a new verification link to your inbox.',
            code: 'EMAIL_NOT_VERIFIED',
          },
          data: { needsVerification: true, email: dbUser.email },
        },
        { status: 403 },
      );
    }

    const token = createVerifiedSessionToken(dbUser.id, dbUser.email);
    const user = { id: dbUser.id, email: dbUser.email };
    const session = { user, access_token: token };

    const response = NextResponse.json({ data: { user, session }, error: null });
    setSessionCookie(response, token);

    return response;
  } catch (err: any) {
    console.error('[POST /api/auth/signin] unexpected error:', err);
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
