import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  deleteTemplate,
  getTemplate,
  updateTemplate,
} from "@/lib/email-marketing/templates";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireRole("agent");
    const template = await getTemplate(auth.accountId, id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { template } });
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
    };
    const template = await updateTemplate(auth.accountId, id, body);
    return NextResponse.json({ data: { template } });
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    await deleteTemplate(auth.accountId, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
