import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  addSubscriber,
  deleteEmailList,
  getEmailList,
  importCsvSubscribers,
  listSubscribers,
  updateEmailList,
} from "@/lib/email-marketing/lists";
import { buildSubscribeUrl } from "@/lib/email-marketing/site-url";
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
} from "@/lib/vedmint-subscription/server";

type Ctx = { params: Promise<{ id: string }> };

async function requireEmailMarketing(userId: string, accountId: string) {
  try {
    await assertCanPerform(userId, accountId, "email_marketing");
    return null;
  } catch (err) {
    if (err instanceof PlanGateError) return planGateResponse(err);
    throw err;
  }
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireRole("agent");
    const gated = await requireEmailMarketing(auth.userId, auth.accountId);
    if (gated) return gated;
    const list = await getEmailList(auth.accountId, id);
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    const subscribers = await listSubscribers(auth.accountId, id, {
      limit: 100,
    });
    return NextResponse.json({
      data: {
        list,
        subscribers,
        subscribe_url: buildSubscribeUrl(list.public_slug),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    const gated = await requireEmailMarketing(auth.userId, auth.accountId);
    if (gated) return gated;
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string | null;
    };
    const list = await updateEmailList(auth.accountId, id, body);
    return NextResponse.json({ data: { list } });
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
    const gated = await requireEmailMarketing(auth.userId, auth.accountId);
    if (gated) return gated;
    await deleteEmailList(auth.accountId, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return toErrorResponse(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const auth = await requireRole("admin");
    const gated = await requireEmailMarketing(auth.userId, auth.accountId);
    if (gated) return gated;
    const list = await getEmailList(auth.accountId, id);
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      const csvText = await request.text();
      const result = await importCsvSubscribers({
        accountId: auth.accountId,
        listId: id,
        csvText,
      });
      const updated = await getEmailList(auth.accountId, id);
      return NextResponse.json({ data: { ...result, list: updated } });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      email?: string;
      name?: string | null;
      csv?: string;
    };

    if (body.action === "import" && typeof body.csv === "string") {
      const result = await importCsvSubscribers({
        accountId: auth.accountId,
        listId: id,
        csvText: body.csv,
      });
      const updated = await getEmailList(auth.accountId, id);
      return NextResponse.json({ data: { ...result, list: updated } });
    }

    if (!body.email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const result = await addSubscriber({
      accountId: auth.accountId,
      listId: id,
      email: body.email,
      name: body.name,
      source: "manual",
      allowReoptIn: true,
    });
    const updated = await getEmailList(auth.accountId, id);
    return NextResponse.json({
      data: { ...result, list: updated },
    });
  } catch (err) {
    if (err instanceof Error && /invalid email/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return toErrorResponse(err);
  }
}
