import type { SupabaseClient } from "@supabase/supabase-js";

import type { WhatsAppConfig } from "@/types";

export type WhatsAppConfigSource = "assigned" | "default" | "team";

export interface ResolvedWhatsAppConfig {
  source: WhatsAppConfigSource;
  config: WhatsAppConfig;
}

type Client = SupabaseClient;

/**
 * Load a specific account WhatsApp number, or the account default / first.
 */
export async function fetchAccountWhatsAppConfig(
  supabase: Client,
  accountId: string,
  preferredConfigId?: string | null,
): Promise<{ data: WhatsAppConfig | null; error: Error | null }> {
  if (preferredConfigId) {
    const { data, error } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("id", preferredConfigId)
      .eq("account_id", accountId)
      .maybeSingle();
    if (error) return { data: null, error: new Error(error.message) };
    if (data) return { data: data as WhatsAppConfig, error: null };
  }

  const { data: defaultRow, error: defaultError } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("account_id", accountId)
    .eq("is_default", 1)
    .maybeSingle();

  if (defaultError) {
    // Column may not exist yet on very old DBs — fall through.
    if (!/unknown column|is_default/i.test(defaultError.message)) {
      return { data: null, error: new Error(defaultError.message) };
    }
  } else if (defaultRow) {
    return { data: defaultRow as WhatsAppConfig, error: null };
  }

  const { data: first, error: firstError } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstError) return { data: null, error: new Error(firstError.message) };
  return { data: (first as WhatsAppConfig) || null, error: null };
}

export async function listAccountWhatsAppConfigs(
  supabase: Client,
  accountId: string,
): Promise<{ data: WhatsAppConfig[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("whatsapp_config")
    .select(
      "id, user_id, account_id, phone_number_id, waba_id, access_token, verify_token, status, connected_at, registered_at, subscribed_apps_at, last_registration_error, display_name, is_default, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data as WhatsAppConfig[]) || [], error: null };
}

/**
 * Resolve which WhatsApp number a user sends from:
 * 1) profile.whatsapp_config_id (assigned by admin)
 * 2) account default number
 * 3) first account number
 */
export async function resolveWhatsAppConfigForUser(
  supabase: Client,
  userId: string,
  accountId: string,
): Promise<{ data: ResolvedWhatsAppConfig | null; error: Error | null }> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("whatsapp_config_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError && !/unknown column|whatsapp_config_id/i.test(profileError.message)) {
    return { data: null, error: new Error(profileError.message) };
  }

  const assignedId =
    (profile as { whatsapp_config_id?: string | null } | null)
      ?.whatsapp_config_id || null;

  if (assignedId) {
    const assigned = await fetchAccountWhatsAppConfig(
      supabase,
      accountId,
      assignedId,
    );
    if (assigned.error) return { data: null, error: assigned.error };
    if (assigned.data) {
      return {
        data: { source: "assigned", config: assigned.data },
        error: null,
      };
    }
  }

  const fallback = await fetchAccountWhatsAppConfig(supabase, accountId);
  if (fallback.error) return { data: null, error: fallback.error };
  if (!fallback.data) return { data: null, error: null };

  return {
    data: {
      source: fallback.data.is_default ? "default" : "team",
      config: fallback.data,
    },
    error: null,
  };
}
