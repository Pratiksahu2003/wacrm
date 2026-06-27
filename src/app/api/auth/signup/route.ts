import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getAuthEmailRedirectTo } from "@/lib/site-url";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      inviteToken?: string | null;
    };

    const email = body.email?.trim();
    const password = body.password;
    const fullName = body.fullName?.trim();
    const inviteToken = body.inviteToken?.trim() || null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const nextPath = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/login";

    let emailRedirectTo: string;
    try {
      emailRedirectTo = getAuthEmailRedirectTo(nextPath);
    } catch (err) {
      console.error("[POST /api/auth/signup] missing site URL:", err);
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: NEXT_PUBLIC_SITE_URL is not set. Auth emails cannot be sent with the correct link.",
        },
        { status: 500 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        emailRedirectTo,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/signup] unexpected error:", err);
    return NextResponse.json(
      { error: "Could not complete signup" },
      { status: 500 },
    );
  }
}
