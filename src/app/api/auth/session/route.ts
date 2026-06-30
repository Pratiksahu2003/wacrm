import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'VedMint Crm-secret-default-encryption-key-32-chars';

export async function GET(request: Request) {
  try {
    const cookiesHeader = request.headers.get('cookie') || '';
    const sessionCookie = cookiesHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('vedmint_crm_session='));

    if (!sessionCookie) {
      return NextResponse.json({ data: { session: null }, error: null });
    }

    const token = sessionCookie.split('=')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ data: { session: null }, error: null });
    }

    const user = { id: decoded.userId, email: decoded.email };
    const session = { user, access_token: token };

    return NextResponse.json({ data: { session }, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: { session: null }, error: null });
  }
}
