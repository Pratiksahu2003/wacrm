import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { query } from "@/lib/mysql";
import { createClient } from "@/lib/supabase/server";
import {
  createVerifiedSessionToken,
  markEmailVerified,
  setSessionCookie,
} from "@/lib/auth-verification";
import {
  getConfiguredSiteUrl,
  sanitizeAuthNextPath,
} from "@/lib/site-url";
import {
  getVedmintConfig,
  issueVedmintToken,
  setVedmintApiTokenCookie,
} from "@/lib/vedmint-subscription/server";

async function attachVedmintToken(
  response: NextResponse,
  userId: string,
  email: string,
): Promise<void> {
  if (!getVedmintConfig().configured) return;
  try {
    const profiles = await query<{ full_name: string | null }>(
      "SELECT full_name FROM profiles WHERE user_id = ? LIMIT 1",
      [userId],
    );
    const issued = await issueVedmintToken({
      externalUserId: userId,
      email,
      name: profiles[0]?.full_name,
    });
    setVedmintApiTokenCookie(response, issued.access_token);
  } catch (err) {
    console.error("[auth/callback] VedMint token issue failed:", err);
  }
}

const JWT_SECRET = process.env.ENCRYPTION_KEY || 'VedMint Crm-secret-default-encryption-key-32-chars';

/**
 * PKCE and password-reset callback handler.
 * - Handles code exchange for standard Supabase flows.
 * - Handles token verification and session bootstrapping for emulator password reset links.
 * - Handles email verification links for new accounts.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const next = sanitizeAuthNextPath(searchParams.get("next"), "/dashboard");

  const redirectBase =
    getConfiguredSiteUrl() ?? new URL(request.url).origin.replace(/\/+$/, "");

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        email?: string;
        type?: string;
      };

      if (decoded.type === "verify-email" && decoded.email) {
        const verified = await markEmailVerified(decoded.email);
        if (verified) {
          const users = await query<{ id: string; email: string }>(
            "SELECT id, email FROM users WHERE email = ?",
            [decoded.email.toLowerCase().trim()],
          );
          const dbUser = users[0];

          if (dbUser) {
            const sessionToken = createVerifiedSessionToken(
              dbUser.id,
              dbUser.email,
            );
            const response = NextResponse.redirect(`${redirectBase}${next}`);
            setSessionCookie(response, sessionToken);
            await attachVedmintToken(response, dbUser.id, dbUser.email);
            return response;
          }
        }

        return NextResponse.redirect(
          `${redirectBase}/verify-email?error=invalid_or_expired`,
        );
      }

      if (decoded.type === "reset-password" && decoded.email) {
        const users = await query<{ id: string; email: string }>(
          "SELECT id, email FROM users WHERE email = ?",
          [decoded.email.toLowerCase().trim()],
        );
        const dbUser = users[0];

        if (dbUser) {
          const sessionToken = createVerifiedSessionToken(
            dbUser.id,
            dbUser.email,
          );

          const response = NextResponse.redirect(`${redirectBase}${next}`);
          setSessionCookie(response, sessionToken);
          await attachVedmintToken(response, dbUser.id, dbUser.email);
          return response;
        }
      }
    } catch (err) {
      console.error("[auth/callback] custom token verification failed:", err);
      return NextResponse.redirect(
        `${redirectBase}/verify-email?error=invalid_or_expired`,
      );
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
