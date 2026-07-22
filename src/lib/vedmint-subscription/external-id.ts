import { createHash } from "crypto";

/**
 * VedMint `/auth/token` requires `external_user_id` as an integer
 * (UUID strings return 422 "must be an integer").
 * Map CRM UUID → stable positive 31-bit int so the same user always
 * gets the same VedMint identity.
 */
export function toExternalUserId(userId: string): number {
  const normalized = String(userId || "").trim().toLowerCase();
  if (!normalized) return 1;

  // Prefer numeric IDs as-is when already integers.
  if (/^\d+$/.test(normalized)) {
    const n = Number(normalized);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }

  const digest = createHash("sha256").update(`wa.vedmint.com:${normalized}`).digest();
  // 31-bit positive int (safe across PHP/JS integer ranges)
  const n = digest.readUInt32BE(0) & 0x7fffffff;
  return n || 1;
}
