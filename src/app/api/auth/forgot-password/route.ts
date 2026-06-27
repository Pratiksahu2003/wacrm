import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getAuthEmailRedirectTo } from "@/lib/site-url";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    let redirectTo: string;
    try {
      redirectTo = getAuthEmailRedirectTo("/reset-password");
    } catch (err) {
      console.error("[POST /api/auth/forgot-password] missing site URL:", err);
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: NEXT_PUBLIC_SITE_URL is not set.",
        },
        { status: 500 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/forgot-password] unexpected error:", err);
    return NextResponse.json(
      { error: "Could not send reset email" },
      { status: 500 },
    );
  }
}
