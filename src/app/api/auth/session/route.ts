import { NextResponse } from "next/server";

import {
  readSessionTokenFromCookieHeader,
  verifySessionToken,
} from "@/lib/session-token";

export async function GET(request: Request) {
  try {
    const token = readSessionTokenFromCookieHeader(
      request.headers.get("cookie"),
    );

    if (!token) {
      return NextResponse.json({ data: { session: null }, error: null });
    }

    const user = await verifySessionToken(token);
    if (!user) {
      return NextResponse.json({ data: { session: null }, error: null });
    }

    const session = { user, access_token: token };

    return NextResponse.json({ data: { session }, error: null });
  } catch {
    return NextResponse.json({ data: { session: null }, error: null });
  }
}
