import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  getCurrentSubscription,
  getVedmintConfig,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

export async function GET() {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          data: {
            configured: false,
            subscription: null,
          },
        },
        { status: 200 },
      );
    }

    const ctx = await getCurrentAccount();
    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      getCurrentSubscription(jwt),
    );

    const response = NextResponse.json({
      data: {
        configured: true,
        subscription: result,
      },
    });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
