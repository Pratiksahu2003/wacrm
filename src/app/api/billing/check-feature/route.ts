import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  checkFeature,
  getVedmintConfig,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

export async function POST(request: Request) {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          data: { allowed: false, remaining: 0, limit: 0 },
          code: "VEDMINT_NOT_CONFIGURED",
        },
        { status: 200 },
      );
    }

    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => ({}))) as {
      feature?: string;
    };
    const feature = body.feature?.trim();
    if (!feature) {
      return NextResponse.json(
        { error: "feature is required" },
        { status: 400 },
      );
    }

    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      checkFeature(jwt, feature),
    );

    const response = NextResponse.json({ data: result });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
