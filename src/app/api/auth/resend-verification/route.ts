import { NextResponse } from "next/server";

import {
  isUserEmailVerified,
  sendUserVerificationEmail,
  verificationEmailErrorMessage,
} from "@/lib/auth-verification";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (await isUserEmailVerified(email)) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
      });
    }

    const users = await queryUserExists(email);
    if (!users) {
      // Do not reveal whether the account exists.
      return NextResponse.json({ ok: true });
    }

    try {
      await sendUserVerificationEmail(email);
    } catch (err) {
      console.error("[POST /api/auth/resend-verification] SMTP error:", err);
      return NextResponse.json(
        { error: verificationEmailErrorMessage(err) },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/resend-verification] unexpected error:", err);
    return NextResponse.json(
      { error: "Could not send verification email" },
      { status: 500 },
    );
  }
}

async function queryUserExists(email: string): Promise<boolean> {
  const { query } = await import("@/lib/mysql");
  const rows = await query("SELECT id FROM users WHERE email = ?", [email]);
  return rows.length > 0;
}
