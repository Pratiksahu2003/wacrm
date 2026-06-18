import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api';
import { decryptIfEncrypted } from '@/lib/whatsapp/encryption';
import {
  normalizeToInternational,
  isValidE164,
  extractCountryCallingCode,
} from '@/lib/whatsapp/phone-utils';

const countryCodeCache = new Map<
  string,
  { cc: string | undefined; expires: number }
>();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getAccountCountryCode(
  supabase: SupabaseClient,
  accountId: string,
): Promise<string | undefined> {
  const cached = countryCodeCache.get(accountId);
  if (cached && cached.expires > Date.now()) {
    return cached.cc;
  }

  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('account_id', accountId)
    .maybeSingle();

  let cc: string | undefined;
  if (config?.phone_number_id && config.access_token) {
    try {
      const accessToken = decryptIfEncrypted(config.access_token).plaintext;
      const info = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      });
      cc = extractCountryCallingCode(info.display_phone_number) ?? undefined;
    } catch {
      cc = undefined;
    }
  }

  countryCodeCache.set(accountId, {
    cc,
    expires: Date.now() + CACHE_TTL_MS,
  });
  return cc;
}

/**
 * Normalize a contact phone to Meta-ready international digits.
 * Throws when the number cannot be resolved (domestic-only formats
 * like 08356864658 are converted using the account's WA number CC).
 */
export async function resolveContactPhoneForMeta(
  supabase: SupabaseClient,
  accountId: string,
  rawPhone: string,
): Promise<string> {
  const cc = await getAccountCountryCode(supabase, accountId);
  const normalized = normalizeToInternational(rawPhone, cc);
  if (!isValidE164(normalized)) {
    throw new Error(`contact phone invalid: ${rawPhone}`);
  }
  return normalized;
}

/** Test-only: clear cached country codes between unit tests. */
export function __resetCountryCodeCacheForTests() {
  countryCodeCache.clear();
}
