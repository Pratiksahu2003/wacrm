import { NextResponse } from "next/server";

import { processEmailCampaign } from "@/lib/email-marketing/campaigns";
import { getEmailCampaignInternalSecret } from "@/lib/email-marketing/trigger";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const expected = getEmailCampaignInternalSecret();
  if (!expected) {
    return NextResponse.json(
      { error: "Email campaign processor not configured" },
      { status: 503 },
    );
  }

  const supplied = request.headers.get("x-cron-secret") ?? "";
  if (supplied !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let campaignId: string | undefined;
  try {
    const body = (await request.json()) as { campaign_id?: string };
    campaignId = body.campaign_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaign_id is required" },
      { status: 400 },
    );
  }

  try {
    await processEmailCampaign(campaignId);
    return NextResponse.json({ ok: true, campaign_id: campaignId });
  } catch (err) {
    console.error(`[email/campaigns/process] error for ${campaignId}:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Campaign processing failed",
      },
      { status: 500 },
    );
  }
}
