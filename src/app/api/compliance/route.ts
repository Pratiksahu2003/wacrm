import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  countOptedOutContacts,
  getComplianceSettings,
  listAuditLogs,
  listOptedOutContacts,
  upsertComplianceSettings,
} from "@/lib/compliance";

export async function GET() {
  try {
    const ctx = await requireRole("agent");
    const [settings, optedOutCount, optedOut, audit] = await Promise.all([
      getComplianceSettings(ctx.accountId),
      countOptedOutContacts(ctx.accountId),
      listOptedOutContacts(ctx.accountId, 50),
      listAuditLogs(ctx.accountId, 40),
    ]);

    return NextResponse.json({
      data: {
        settings,
        opted_out_count: optedOutCount,
        opted_out: optedOut,
        audit,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = (await request.json().catch(() => ({}))) as {
      opt_out_keywords?: string[];
      opt_in_keywords?: string[];
      opt_out_reply?: string;
      opt_in_reply?: string;
      auto_reply_enabled?: boolean;
      exclude_from_broadcasts?: boolean;
    };

    const settings = await upsertComplianceSettings(ctx.accountId, {
      opt_out_keywords: Array.isArray(body.opt_out_keywords)
        ? body.opt_out_keywords.map((k) => String(k).trim()).filter(Boolean)
        : undefined,
      opt_in_keywords: Array.isArray(body.opt_in_keywords)
        ? body.opt_in_keywords.map((k) => String(k).trim()).filter(Boolean)
        : undefined,
      opt_out_reply:
        typeof body.opt_out_reply === "string" ? body.opt_out_reply : undefined,
      opt_in_reply:
        typeof body.opt_in_reply === "string" ? body.opt_in_reply : undefined,
      auto_reply_enabled:
        typeof body.auto_reply_enabled === "boolean"
          ? body.auto_reply_enabled
          : undefined,
      exclude_from_broadcasts:
        typeof body.exclude_from_broadcasts === "boolean"
          ? body.exclude_from_broadcasts
          : undefined,
    });

    return NextResponse.json({ data: { settings } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
