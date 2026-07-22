import { NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { getEntitlementSnapshot } from "@/lib/vedmint-subscription/enforce";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";
import { VedmintApiError } from "@/lib/vedmint-subscription";

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const snap = await getEntitlementSnapshot(ctx.userId, ctx.accountId);
    return NextResponse.json({ data: snap });
  } catch (err) {
    if (err instanceof VedmintApiError) {
      return toBillingErrorResponse(err);
    }
    return toErrorResponse(err);
  }
}
