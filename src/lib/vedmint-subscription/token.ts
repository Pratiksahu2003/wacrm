import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { query } from "@/lib/mysql";
import { VEDMINT_API_TOKEN_COOKIE, getVedmintConfig } from "./config";
import { issueVedmintToken } from "./client";
import { VedmintApiError } from "./types";

const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year; API may set expires_in=null

export function setVedmintApiTokenCookie(
  response: NextResponse,
  token: string,
  maxAge = TOKEN_MAX_AGE_SECONDS,
): void {
  response.cookies.set(VEDMINT_API_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearVedmintApiTokenCookie(response: NextResponse): void {
  response.cookies.set(VEDMINT_API_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function readTokenFromCookieStore(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(VEDMINT_API_TOKEN_COOKIE)?.value || null;
}

async function resolveUserProfile(userId: string): Promise<{
  email: string;
  name: string | null;
}> {
  const rows = await query<{ email: string; full_name: string | null }>(
    `SELECT u.email, p.full_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("User not found for VedMint token issuance");
  }
  return { email: row.email, name: row.full_name };
}

/**
 * Ensure we have a valid VedMint API JWT for the CRM user.
 * Re-uses the httpOnly cookie when present; otherwise issues a fresh token.
 */
export async function ensureVedmintAccessToken(
  userId: string,
  opts?: { forceRefresh?: boolean; email?: string; name?: string | null },
): Promise<{ token: string; issued: boolean }> {
  const config = getVedmintConfig();
  if (!config.configured) {
    throw new VedmintApiError(
      "VedMint Subscription API is not configured. Set VEDMINT_APP_KEY and VEDMINT_APP_SECRET in the server environment.",
      503,
      "VEDMINT_NOT_CONFIGURED",
    );
  }

  if (!opts?.forceRefresh) {
    const existing = await readTokenFromCookieStore();
    if (existing) return { token: existing, issued: false };
  }

  const profile =
    opts?.email != null
      ? { email: opts.email, name: opts.name ?? null }
      : await resolveUserProfile(userId);

  const issued = await issueVedmintToken({
    externalUserId: userId,
    email: profile.email,
    name: profile.name,
  });

  return { token: issued.access_token, issued: true };
}

/**
 * Run a VedMint-authenticated call with one automatic re-issue on AUTH_TOKEN_EXPIRED.
 * Returns the result plus an optional fresh token the route should set on the response.
 */
export async function withVedmintToken<T>(
  userId: string,
  fn: (token: string) => Promise<T>,
): Promise<{ result: T; freshToken?: string }> {
  const first = await ensureVedmintAccessToken(userId);
  try {
    const result = await fn(first.token);
    return {
      result,
      freshToken: first.issued ? first.token : undefined,
    };
  } catch (err) {
    const expired =
      err instanceof VedmintApiError &&
      (err.status === 401 ||
        err.code === "AUTH_TOKEN_EXPIRED" ||
        /expired|unauthorized/i.test(err.message));

    if (!expired) throw err;

    const refreshed = await ensureVedmintAccessToken(userId, {
      forceRefresh: true,
    });
    const result = await fn(refreshed.token);
    return { result, freshToken: refreshed.token };
  }
}

/** Attach a freshly issued VedMint JWT to an existing JSON response. */
export function attachVedmintTokenIfNeeded(
  response: NextResponse,
  freshToken?: string,
): NextResponse {
  if (freshToken) setVedmintApiTokenCookie(response, freshToken);
  return response;
}
