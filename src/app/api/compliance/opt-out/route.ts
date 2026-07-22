import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { setContactOptOut, writeAuditLog } from "@/lib/compliance";
import { query } from "@/lib/mysql";

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("agent");
    const body = (await request.json().catch(() => ({}))) as {
      contact_id?: string;
      opted_out?: boolean;
    };

    const contactId = String(body.contact_id || "").trim();
    if (!contactId) {
      return NextResponse.json(
        { error: "contact_id is required" },
        { status: 400 },
      );
    }
    if (typeof body.opted_out !== "boolean") {
      return NextResponse.json(
        { error: "opted_out boolean is required" },
        { status: 400 },
      );
    }

    const rows = await query<{ id: string }>(
      `SELECT id FROM contacts WHERE id = ? AND account_id = ? LIMIT 1`,
      [contactId, ctx.accountId],
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await setContactOptOut({
      accountId: ctx.accountId,
      contactId,
      optedOut: body.opted_out,
      source: "manual",
      actorUserId: ctx.userId,
    });

    await writeAuditLog({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: body.opted_out
        ? "contact.opt_out.manual"
        : "contact.opt_in.manual",
      entityType: "contact",
      entityId: contactId,
      meta: { via: "api" },
    });

    return NextResponse.json({
      data: { contact_id: contactId, opted_out: body.opted_out },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
