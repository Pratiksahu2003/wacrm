import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "@/lib/mysql";
import { createClient } from "@/lib/supabase/server";
import {
  getConfiguredSiteUrl,
  sanitizeAuthNextPath,
} from "@/lib/site-url";

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'VedMint Crm-secret-default-encryption-key-32-chars';

/**
 * PKCE and password-reset callback handler.
 * - Handles code exchange for standard Supabase flows.
 * - Handles token verification and session bootstrapping for emulator password reset links.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const next = sanitizeAuthNextPath(searchParams.get("next"), "/login");

  const redirectBase =
    getConfiguredSiteUrl() ?? new URL(request.url).origin.replace(/\/+$/, "");

  // Custom JWT password reset link handling
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { email?: string; type?: string };
      if (decoded.type === "reset-password" && decoded.email) {
        const users = await query("SELECT id, email FROM users WHERE email = ?", [decoded.email.toLowerCase().trim()]);
        const dbUser = users[0];
        
        if (dbUser) {
          const sessionToken = jwt.sign(
            { userId: dbUser.id, email: dbUser.email },
            JWT_SECRET,
            { expiresIn: "7d" }
          );

          const response = NextResponse.redirect(`${redirectBase}${next}`);
          
          response.cookies.set("vedmint_crm_session", sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });

          return response;
        }
      }
    } catch (err) {
      console.error("[auth/callback] custom token verification failed:", err);
    }
  }

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
