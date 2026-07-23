import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  deleteSmtpSettings,
  getSmtpSettings,
  sendSmtpTestEmail,
  upsertSmtpSettings,
  verifySmtpConnection,
} from "@/lib/email-marketing/smtp";
import {
  assertCanPerform,
  PlanGateError,
  planGateResponse,
} from "@/lib/vedmint-subscription/server";

async function requireEmailMarketing(userId: string, accountId: string) {
  try {
    await assertCanPerform(userId, accountId, "email_marketing");
    return null;
  } catch (err) {
    if (err instanceof PlanGateError) return planGateResponse(err);
    throw err;
  }
}

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const gated = await requireEmailMarketing(ctx.userId, ctx.accountId);
    if (gated) return gated;
    const settings = await getSmtpSettings(ctx.accountId);
    return NextResponse.json({ data: { settings } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const gated = await requireEmailMarketing(ctx.userId, ctx.accountId);
    if (gated) return gated;

    const body = (await request.json().catch(() => ({}))) as {
      host?: string;
      port?: number;
      secure?: boolean;
      username?: string;
      password?: string;
      from_name?: string | null;
      from_email?: string;
      reply_to?: string | null;
    };

    if (!body.host || !body.username || !body.from_email) {
      return NextResponse.json(
        { error: "host, username, and from_email are required" },
        { status: 400 },
      );
    }

    const settings = await upsertSmtpSettings(ctx.accountId, {
      host: body.host,
      port: Number(body.port) || 587,
      secure: Boolean(body.secure),
      username: body.username,
      password: body.password,
      from_name: body.from_name,
      from_email: body.from_email,
      reply_to: body.reply_to,
    });

    return NextResponse.json({ data: { settings } });
  } catch (err) {
    if (err instanceof Error && /required/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return toErrorResponse(err);
  }
}

export async function DELETE() {
  try {
    const ctx = await requireRole("admin");
    const gated = await requireEmailMarketing(ctx.userId, ctx.accountId);
    if (gated) return gated;
    await deleteSmtpSettings(ctx.accountId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const gated = await requireEmailMarketing(ctx.userId, ctx.accountId);
    if (gated) return gated;

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      to?: string;
    };

    if (body.action === "verify") {
      const result = await verifySmtpConnection(ctx.accountId);
      return NextResponse.json({ data: result });
    }

    if (body.action === "test") {
      const to = (body.to || "").trim();
      if (!to) {
        return NextResponse.json(
          { error: "to is required for test emails" },
          { status: 400 },
        );
      }
      const result = await sendSmtpTestEmail(ctx.accountId, to);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json(
      { error: "action must be verify or test" },
      { status: 400 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
