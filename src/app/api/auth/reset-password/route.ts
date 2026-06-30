import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getAuthEmailRedirectTo } from "@/lib/site-url";
import { smtpErrorMessage } from "@/lib/auth-mail";

/** Send a password-reset email (used by the auth emulator client). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      options?: { redirectTo?: string };
    };
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: { message: "Email is required" } },
        { status: 400 },
      );
    }

    let redirectTo = body.options?.redirectTo;
    if (!redirectTo) {
      try {
        redirectTo = getAuthEmailRedirectTo("/reset-password");
      } catch (err) {
        console.error("[POST /api/auth/reset-password] missing site URL:", err);
        return NextResponse.json(
          {
            error: {
              message:
                "Server misconfiguration: NEXT_PUBLIC_SITE_URL is not set.",
            },
          },
          { status: 500 },
        );
      }
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ error: null });
  } catch (err) {
    console.error("[POST /api/auth/reset-password] unexpected error:", err);
    return NextResponse.json(
      { error: { message: smtpErrorMessage(err) } },
      { status: 500 },
    );
  }
}
