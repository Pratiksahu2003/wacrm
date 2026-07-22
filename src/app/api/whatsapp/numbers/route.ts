import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { listAccountWhatsAppConfigs } from "@/lib/whatsapp/resolve-config";

export const runtime = "nodejs";

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.account_id) return null;
  return data.account_id as string;
}

/** GET /api/whatsapp/numbers — list all WhatsApp numbers for the account. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountId = await resolveAccountId(supabase, user.id);
    if (!accountId) {
      return NextResponse.json({ numbers: [] });
    }

    const { data, error } = await listAccountWhatsAppConfigs(supabase, accountId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const numbers = data.map((row) => ({
      id: row.id,
      phone_number_id: row.phone_number_id,
      waba_id: row.waba_id ?? null,
      display_name: row.display_name ?? null,
      is_default: Boolean(row.is_default),
      status: row.status,
      registered_at: row.registered_at ?? null,
    }));

    return NextResponse.json({ numbers });
  } catch (err) {
    console.error("[GET /api/whatsapp/numbers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH /api/whatsapp/numbers — set default number. */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountId = await resolveAccountId(supabase, user.id);
    if (!accountId) {
      return NextResponse.json({ error: "No account" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      is_default?: boolean;
    };
    if (!body.id || body.is_default !== true) {
      return NextResponse.json(
        { error: "id and is_default:true required" },
        { status: 400 },
      );
    }

    const { data: row } = await supabase
      .from("whatsapp_config")
      .select("id")
      .eq("id", body.id)
      .eq("account_id", accountId)
      .maybeSingle();
    if (!row) {
      return NextResponse.json({ error: "Number not found" }, { status: 404 });
    }

    await supabase
      .from("whatsapp_config")
      .update({ is_default: 0 })
      .eq("account_id", accountId);
    await supabase
      .from("whatsapp_config")
      .update({ is_default: 1 })
      .eq("id", body.id)
      .eq("account_id", accountId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/whatsapp/numbers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
