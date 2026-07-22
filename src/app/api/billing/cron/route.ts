import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { applyLocalPlanExpiry } from "@/lib/vedmint-subscription/expire-local";
import {
  ensureSubscriptionStateTable,
  listDueExpirations,
  markExpiredApplied,
} from "@/lib/vedmint-subscription/subscription-state";

/**
 * GET /api/billing/cron
 *
 * Applies local plan expiry for accounts whose cached `expires_at` has
 * passed: pauses active automations and drafts active flows.
 *
 * Auth: `x-cron-secret` must match `AUTOMATION_CRON_SECRET` (same as
 * other CRM crons). Schedule every 5–15 minutes.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }

  const supplied = request.headers.get("x-cron-secret") ?? "";
  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(expected);
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureSubscriptionStateTable();
    const due = await listDueExpirations();
    const results: Array<{
      accountId: string;
      automationsPaused: number;
      flowsPaused: number;
    }> = [];

    for (const row of due) {
      const applied = await applyLocalPlanExpiry(row.account_id);
      await markExpiredApplied(row.account_id);
      results.push({
        accountId: row.account_id,
        automationsPaused: applied.automationsPaused,
        flowsPaused: applied.flowsPaused,
      });
    }

    return NextResponse.json({
      ok: true,
      expiredAccounts: results.length,
      results,
    });
  } catch (err) {
    console.error("[GET /api/billing/cron]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "cron failed" },
      { status: 500 },
    );
  }
}
