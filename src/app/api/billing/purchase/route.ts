import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/account";
import { OFFICIAL_APP_URL } from "@/lib/brand";
import { getConfiguredSiteUrl } from "@/lib/site-url";
import {
  attachVedmintTokenIfNeeded,
  getVedmintConfig,
  purchaseSubscription,
  withVedmintToken,
  type BillingCycle,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";

function billingAppUrl(path: string): string {
  const base = (getConfiguredSiteUrl() || OFFICIAL_APP_URL).replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

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

    // Billing changes are account-admin actions.
    const ctx = await requireRole("admin");
    const body = (await request.json().catch(() => ({}))) as {
      plan_id?: number;
      billing_cycle?: BillingCycle;
      coupon_code?: string;
    };

    const planId = Number(body.plan_id);
    if (!Number.isFinite(planId) || planId <= 0) {
      return NextResponse.json(
        { error: "A valid plan_id is required" },
        { status: 400 },
      );
    }

    const billingCycle: BillingCycle =
      body.billing_cycle === "yearly" ? "yearly" : "monthly";

    const { result, freshToken } = await withVedmintToken(ctx.userId, (jwt) =>
      purchaseSubscription(jwt, {
        planId,
        billingCycle,
        couponCode: body.coupon_code?.trim() || undefined,
        successUrl: billingAppUrl("/billing/return"),
        cancelUrl: billingAppUrl("/billing"),
      }),
    );

    if (!result?.payment_url) {
      return NextResponse.json(
        { error: "Purchase did not return a payment URL" },
        { status: 502 },
      );
    }

    const response = NextResponse.json({ data: result });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
