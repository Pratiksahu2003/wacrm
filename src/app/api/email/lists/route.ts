import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  createEmailList,
  listEmailLists,
} from "@/lib/email-marketing/lists";
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
} from "@/lib/vedmint-subscription/server";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const lists = await listEmailLists(ctx.accountId);
    return NextResponse.json({ data: { lists } });
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
      description?: string | null;
      public_slug?: string;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const list = await createEmailList(ctx.accountId, {
      name: body.name,
      description: body.description,
      public_slug: body.public_slug,
    });
    return NextResponse.json({ data: { list } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
