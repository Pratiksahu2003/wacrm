import { OFFICIAL_APP_URL } from "@/lib/brand";

export interface VedmintSubscriptionConfig {
  url: string;
  key: string;
  secret: string;
  origin: string;
  configured: boolean;
}

/** Cookie that holds the VedMint Subscription API JWT (separate from CRM session). */
export const VEDMINT_API_TOKEN_COOKIE = "vedmint_api_token";

export function getVedmintConfig(): VedmintSubscriptionConfig {
  const url = (
    process.env.VEDMINT_API_URL || "https://vedmint.com/api/v1"
  ).replace(/\/+$/, "");
  const key = process.env.VEDMINT_APP_KEY?.trim() || "";
  const secret = process.env.VEDMINT_APP_SECRET?.trim() || "";
  const origin = (
    process.env.VEDMINT_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    OFFICIAL_APP_URL
  ).replace(/\/+$/, "");

  return {
    url,
    key,
    secret,
    origin,
    configured: Boolean(key && secret),
  };
}

export function assertVedmintConfigured(
  config: VedmintSubscriptionConfig = getVedmintConfig(),
): VedmintSubscriptionConfig {
  if (!config.configured) {
    throw new Error(
      "VedMint Subscription API is not configured. Set VEDMINT_APP_KEY and VEDMINT_APP_SECRET.",
    );
  }
  return config;
}
