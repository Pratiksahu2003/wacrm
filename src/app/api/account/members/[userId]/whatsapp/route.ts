import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";

/**
 * PATCH /api/account/members/[userId]/whatsapp
 * Assign (or clear) a WhatsApp number for a team member.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");
    const { userId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      whatsapp_config_id?: string | null;
    };

    const targetId = String(userId || "").trim();
    if (!targetId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const { data: member } = await ctx.supabase
      .from("profiles")
      .select("user_id, account_id")
      .eq("user_id", targetId)
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const configId =
      body.whatsapp_config_id === null || body.whatsapp_config_id === ""
        ? null
        : String(body.whatsapp_config_id || "").trim() || null;

    if (configId) {
      const { data: number } = await ctx.supabase
        .from("whatsapp_config")
        .select("id")
        .eq("id", configId)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (!number) {
        return NextResponse.json(
          { error: "WhatsApp number not found on this account" },
          { status: 400 },
        );
      }
    }

    const { error } = await ctx.supabase
      .from("profiles")
      .update({ whatsapp_config_id: configId })
      .eq("user_id", targetId)
      .eq("account_id", ctx.accountId);

    if (error) {
      console.error("[PATCH member whatsapp]", error);
      return NextResponse.json(
        { error: "Failed to assign WhatsApp number" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: { user_id: targetId, whatsapp_config_id: configId },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
