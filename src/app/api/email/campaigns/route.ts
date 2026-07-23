import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  createCampaign,
  listCampaigns,
} from "@/lib/email-marketing/campaigns";
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
} from "@/lib/vedmint-subscription/server";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    try {
      await assertCanPerform(ctx.userId, ctx.accountId, "email_marketing");
    } catch (err) {
      if (err instanceof PlanGateError) return planGateResponse(err);
      throw err;
    }
    const campaigns = await listCampaigns(ctx.accountId);
    return NextResponse.json({ data: { campaigns } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    try {
      await assertCanPerform(ctx.userId, ctx.accountId, "email_marketing");
    } catch (err) {
      if (err instanceof PlanGateError) return planGateResponse(err);
      throw err;
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      list_id?: string;
      template_id?: string | null;
      subject?: string;
      html_body?: string;
      text_body?: string | null;
    };

    if (!body.list_id) {
      return NextResponse.json({ error: "list_id is required" }, { status: 400 });
    }

    const campaign = await createCampaign(ctx.accountId, ctx.userId, {
      name: body.name || "Untitled campaign",
      list_id: body.list_id,
      template_id: body.template_id,
      subject: body.subject,
      html_body: body.html_body,
      text_body: body.text_body,
    });
    return NextResponse.json({ data: { campaign } }, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return toErrorResponse(err);
  }
}
