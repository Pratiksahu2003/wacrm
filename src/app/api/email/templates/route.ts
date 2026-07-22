import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  createTemplate,
  listTemplates,
  STARTER_TEMPLATE_HTML,
} from "@/lib/email-marketing/templates";
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
} from "@/lib/vedmint-subscription/server";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const templates = await listTemplates(ctx.accountId);
    return NextResponse.json({
      data: { templates, starter_html: STARTER_TEMPLATE_HTML },
    });
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
      subject?: string;
      html_body?: string;
      text_body?: string | null;
    };

    const template = await createTemplate(ctx.accountId, {
      name: body.name || "",
      subject: body.subject || "",
      html_body: body.html_body || "",
      text_body: body.text_body,
    });
    return NextResponse.json({ data: { template } }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /required/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return toErrorResponse(err);
  }
}
