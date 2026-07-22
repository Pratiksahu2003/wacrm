import { NextResponse } from "next/server";

import {
  mapVedmintPlansToPublic,
  PUBLIC_SUBSCRIPTION_PLANS,
} from "@/lib/marketing/public-plans";
import {
  getVedmintConfig,
  listPlans,
} from "@/lib/vedmint-subscription/server";

/**
 * GET /api/billing/public-plans
 * Unauthenticated catalog for marketing /pricing — uses app credentials.
 * Falls back to static Starter / Business / Enterprise amounts if API is down.
 */
export async function GET() {
  const config = getVedmintConfig();
  if (!config.configured) {
    return NextResponse.json({
      data: {
        plans: PUBLIC_SUBSCRIPTION_PLANS,
        source: "fallback",
      },
    });
  }

  try {
    const apiPlans = await listPlans();
    const plans = mapVedmintPlansToPublic(apiPlans);
    return NextResponse.json({
      data: {
        plans: plans.length > 0 ? plans : PUBLIC_SUBSCRIPTION_PLANS,
        source: plans.length > 0 ? "api" : "fallback",
      },
    });
  } catch (err) {
    console.warn(
      "[GET /api/billing/public-plans] falling back to static plans:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({
      data: {
        plans: PUBLIC_SUBSCRIPTION_PLANS,
        source: "fallback",
      },
    });
  }
}
