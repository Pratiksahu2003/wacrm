import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  downgradeSubscription,
  getVedmintConfig,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

/** POST /api/billing/downgrade — switch to a lower plan (immediate). */
export async function POST(request: Request) {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          error:
            "VedMint Subscription API is not configured. Set VEDMINT_APP_KEY and VEDMINT_APP_SECRET.",
          code: "VEDMINT_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const ctx = await requireRole("admin");
    const body = (await request.json().catch(() => ({}))) as {
      plan_id?: number;
    };

    const planId = Number(body.plan_id);
    if (!Number.isFinite(planId) || planId <= 0) {
      return NextResponse.json(
        { error: "A valid plan_id is required" },
        { status: 400 },
      );
    }

    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      downgradeSubscription(jwt, { planId }),
    );

    const response = NextResponse.json({ data: result });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
