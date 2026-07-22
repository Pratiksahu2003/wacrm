import { NextResponse } from "next/server";

import { sweepEmailCampaigns } from "@/lib/email-marketing/campaigns";
import { getEmailCampaignInternalSecret } from "@/lib/email-marketing/trigger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const expected = getEmailCampaignInternalSecret();
  if (!expected) {
    return NextResponse.json(
      { error: "Email campaign cron not configured" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const supplied =
    request.headers.get("x-cron-secret") ??
    url.searchParams.get("secret") ??
    "";
  if (supplied !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepEmailCampaigns();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[email/campaigns/cron]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 },
    );
  }
}
