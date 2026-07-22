import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  getPlanFeatures,
  getVedmintConfig,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

export async function GET() {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json({ data: { features: [] } });
    }

    const ctx = await getCurrentAccount();
    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      getPlanFeatures(jwt),
    );

    const response = NextResponse.json({ data: { features: result } });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
