import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

import { sendVerificationEmail, smtpErrorMessage } from "@/lib/auth-mail";
import { query } from "@/lib/mysql";
import { getAuthEmailRedirectTo } from "@/lib/site-url";

const JWT_SECRET =
  process.env.ENCRYPTION_KEY ||
  "VedMint Crm-secret-default-encryption-key-32-chars";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmailVerifiedFlag(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

export async function isUserEmailVerified(email: string): Promise<boolean> {
  const rows = await query<{ email_verified: number | boolean }>(
    "SELECT email_verified FROM users WHERE email = ?",
    [normalizeAuthEmail(email)],
  );
  return rows.length > 0 && isEmailVerifiedFlag(rows[0].email_verified);
}

export function createEmailVerificationToken(email: string): string {
  return jwt.sign(
    { email: normalizeAuthEmail(email), type: "verify-email" },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}

export function createVerifiedSessionToken(
  userId: string,
  email: string,
): string {
  return jwt.sign({ userId, email, ev: 1 }, JWT_SECRET, { expiresIn: "7d" });
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set("vedmint_crm_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function sendUserVerificationEmail(
  email: string,
  nextPath = "/dashboard",
): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  const redirectTo = getAuthEmailRedirectTo(nextPath);
  const token = createEmailVerificationToken(normalized);
  await sendVerificationEmail(normalized, redirectTo, token);
}

export async function markEmailVerified(email: string): Promise<boolean> {
  const normalized = normalizeAuthEmail(email);
  await query("UPDATE users SET email_verified = 1 WHERE email = ?", [
    normalized,
  ]);
  const users = await query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE email = ? AND email_verified = 1",
    [normalized],
  );
  return users.length > 0;
}

export function verificationEmailErrorMessage(err: unknown): string {
  return smtpErrorMessage(err).replace(
    "reset email",
    "verification email",
  );
}
