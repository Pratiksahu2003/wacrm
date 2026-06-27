import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { decryptIfEncrypted, encrypt } from "@/lib/whatsapp/encryption";

export const runtime = "nodejs";

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.account_id as string | undefined) ?? null;
}

/** GET — load the signed-in member's optional personal WhatsApp config. */
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

    const { data, error } = await supabase
      .from("member_whatsapp_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasToken = Boolean(data?.access_token);
    const safe = data
      ? {
          user_id: data.user_id,
          account_id: data.account_id,
          use_personal: data.use_personal,
          phone_number_id: data.phone_number_id,
          waba_id: data.waba_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }
      : null;

    return NextResponse.json({
      config: safe,
      has_token: hasToken,
    });
  } catch (err) {
    console.error("[GET /api/whatsapp/member-config]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — save personal WhatsApp credentials for the signed-in member. */
export async function POST(request: Request) {
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
      return NextResponse.json({ error: "No account" }, { status: 400 });
    }

    const body = (await request.json()) as {
      use_personal?: boolean;
      phone_number_id?: string;
      waba_id?: string;
      access_token?: string;
      verify_token?: string;
    };

    const { data: existing } = await supabase
      .from("member_whatsapp_config")
      .select("access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    let accessToken = existing?.access_token ?? null;
    if (body.access_token?.trim()) {
      accessToken = encrypt(body.access_token.trim());
    }

    const row = {
      user_id: user.id,
      account_id: accountId,
      use_personal: Boolean(body.use_personal),
      phone_number_id: body.phone_number_id?.trim() || null,
      waba_id: body.waba_id?.trim() || null,
      access_token: accessToken,
      verify_token: body.verify_token?.trim()
        ? encrypt(body.verify_token.trim())
        : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("member_whatsapp_config")
      .upsert(row, { onConflict: "user_id" })
      .select(
        "user_id, account_id, use_personal, phone_number_id, waba_id, created_at, updated_at",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ config: data, has_token: Boolean(accessToken) });
  } catch (err) {
    console.error("[POST /api/whatsapp/member-config]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE — remove personal credentials (revert to team config only). */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("member_whatsapp_config")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/whatsapp/member-config]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
