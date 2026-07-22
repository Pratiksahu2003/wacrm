import { jwtVerify } from "jose";

export type SessionUser = { id: string; email: string };

function sessionSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.ENCRYPTION_KEY ||
      "VedMint Crm-secret-default-encryption-key-32-chars",
  );
}

/** Verify a vedmint_crm_session JWT. Works in Proxy and Node routes. */
export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (typeof payload.userId !== "string") return null;
    return {
      id: payload.userId,
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch {
    return null;
  }
}

export function readSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("vedmint_crm_session="));
  if (!sessionCookie) return null;
  const token = sessionCookie.slice("vedmint_crm_session=".length);
  return token || null;
}

/** Read and verify the session user from an incoming Request cookie header. */
export async function sessionUserFromRequest(
  request: Request,
): Promise<SessionUser | null> {
  const token = readSessionTokenFromCookieHeader(request.headers.get("cookie"));
  if (!token) return null;
  return verifySessionToken(token);
}
