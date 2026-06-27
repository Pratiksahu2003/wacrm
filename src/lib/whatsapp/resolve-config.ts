import type { SupabaseClient } from "@supabase/supabase-js";

import type { WhatsAppConfig } from "@/types";

export type WhatsAppConfigSource = "team" | "personal";

export interface ResolvedWhatsAppConfig {
  source: WhatsAppConfigSource;
  config: WhatsAppConfig;
}

/**
 * Pick team (account) or personal member WhatsApp credentials for sending.
 * Personal config is used only when the member opted in and saved credentials.
 */
export async function resolveWhatsAppConfigForUser(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<{ data: ResolvedWhatsAppConfig | null; error: Error | null }> {
  const { data: personal, error: personalError } = await supabase
    .from("member_whatsapp_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (personalError) {
    return { data: null, error: new Error(personalError.message) };
  }

  if (
    personal?.use_personal &&
    personal.phone_number_id &&
    personal.access_token
  ) {
    return {
      data: {
        source: "personal",
        config: personal as WhatsAppConfig,
      },
      error: null,
    };
  }

  const { data: team, error: teamError } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (teamError) {
    return { data: null, error: new Error(teamError.message) };
  }
  if (!team) {
    return { data: null, error: null };
  }

  return {
    data: {
      source: "team",
      config: team as WhatsAppConfig,
    },
    error: null,
  };
}
