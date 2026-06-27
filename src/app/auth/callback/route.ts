import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  getConfiguredSiteUrl,
  sanitizeAuthNextPath,
} from "@/lib/site-url";

/**
 * Supabase PKCE callback — exchanges `?code=` for a session cookie, then
 * redirects to the `next` path (signup verify → /login, invite → /join/…).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeAuthNextPath(searchParams.get("next"), "/login");

  const redirectBase =
    getConfiguredSiteUrl() ?? new URL(request.url).origin.replace(/\/+$/, "");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession:", error.message);
  }

  return NextResponse.redirect(
    `${redirectBase}/login?error=auth_callback_error`,
  );
}
