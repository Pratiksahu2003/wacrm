import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  getVedmintConfig,
  listPlans,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

export async function GET() {
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

    const ctx = await getCurrentAccount();
    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      listPlans(jwt),
    );

    const response = NextResponse.json({ data: { plans: result } });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
