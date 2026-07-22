import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  cancelSubscription,
  getVedmintConfig,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

export async function POST() {
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
    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      cancelSubscription(jwt),
    );

    const response = NextResponse.json({ data: result ?? { cancelled: true } });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
