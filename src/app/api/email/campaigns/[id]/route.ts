import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  getCampaign,
  listCampaignRecipients,
  startCampaign,
  updateCampaignDraft,
} from "@/lib/email-marketing/campaigns";
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
} from "@/lib/vedmint-subscription/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireRole("agent");
    const campaign = await getCampaign(auth.accountId, id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const recipients = await listCampaignRecipients(auth.accountId, id, 50);
    return NextResponse.json({ data: { campaign, recipients } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      subject?: string;
      html_body?: string;
      text_body?: string | null;
      action?: string;
      scheduled_at?: string | null;
    };

    if (body.action === "start") {
      try {
        await assertCanPerform(auth.userId, auth.accountId, "email_marketing");
      } catch (err) {
        if (err instanceof PlanGateError) return planGateResponse(err);
        throw err;
      }
      const campaign = await startCampaign(auth.accountId, id, {
        scheduled_at: body.scheduled_at,
      });
      return NextResponse.json({ data: { campaign } });
    }

    const campaign = await updateCampaignDraft(auth.accountId, id, body);
    return NextResponse.json({ data: { campaign } });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return toErrorResponse(err);
  }
}
