import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  getVedmintConfig,
  listInvoices,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

export async function GET() {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          data: { configured: false, invoices: [] },
        },
        { status: 200 },
      );
    }

    const ctx = await getCurrentAccount();
    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      listInvoices(jwt),
    );

    const response = NextResponse.json({
      data: {
        configured: true,
        invoices: result,
      },
    });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
