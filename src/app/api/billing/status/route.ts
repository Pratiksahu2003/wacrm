import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import { getVedmintConfig } from "@/lib/vedmint-subscription/config";
import { getEntitlementSnapshot } from "@/lib/vedmint-subscription/enforce";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";
import { VedmintApiError } from "@/lib/vedmint-subscription/types";
import { toErrorResponse } from "@/lib/auth/account";

export async function GET() {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          data: {
            configured: false,
            active: false,
            status: "unconfigured",
            expired: false,
            expires_at: null,
          },
        },
        { status: 200 },
      );
    }

    const ctx = await getCurrentAccount();
    const snap = await getEntitlementSnapshot(ctx.userId, ctx.accountId);

    return NextResponse.json({
      data: {
        configured: true,
        active: snap.active,
        status: snap.status,
        plan_name: snap.planName,
        plan_id: snap.planId,
        expires_at: snap.expiresAt,
        expired: snap.expired,
        expiring_soon: snap.expiringSoon,
        days_remaining: snap.daysRemaining,
      },
    });
  } catch (err) {
    if (err instanceof VedmintApiError) return toBillingErrorResponse(err);
    return toErrorResponse(err);
  }
}
