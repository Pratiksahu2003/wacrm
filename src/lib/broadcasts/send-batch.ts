import { sendTemplateMessage, verifyPhoneNumber } from '@/lib/whatsapp/meta-api';
import { decryptIfEncrypted } from '@/lib/whatsapp/encryption';
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard';
import type { MessageTemplate } from '@/types';
import {
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
  extractCountryCallingCode,
  normalizeToInternational,
} from '@/lib/whatsapp/phone-utils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BroadcastSendRecipient, BroadcastSendResult } from './types';

const META_SEND_DELAY_MS = 150;
const META_RATE_LIMIT_MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMetaRateLimitError(message: string): boolean {
  return /rate limit|\(#4\)|\(#80007\)/i.test(message);
}

export interface SendTemplateBatchArgs {
  supabase: SupabaseClient;
  accountId: string;
  templateName: string;
  templateLanguage?: string;
  recipients: BroadcastSendRecipient[];
}

/**
 * Send a batch of template messages via Meta. Shared by the HTTP
 * broadcast route and the background processor.
 */
export async function sendTemplateBatch(
  args: SendTemplateBatchArgs,
): Promise<BroadcastSendResult[]> {
  const { supabase, accountId, templateName, templateLanguage, recipients } =
    args;

  if (recipients.length === 0) return [];

  const { data: config, error: configError } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (configError || !config) {
    throw new Error('WhatsApp not configured for this account.');
  }

  const decodedToken = decryptIfEncrypted(config.access_token);
  const accessToken = decodedToken.plaintext;

  let defaultCountryCode: string | undefined;
  try {
    const phoneInfo = await verifyPhoneNumber({
      phoneNumberId: config.phone_number_id,
      accessToken,
    });
    defaultCountryCode =
      extractCountryCallingCode(phoneInfo.display_phone_number) ?? undefined;
  } catch {
    // Non-fatal — normalization falls back to digits as-is.
  }

  let templateQuery = supabase
    .from('message_templates')
    .select('*')
    .eq('account_id', accountId)
    .eq('name', templateName);
  if (templateLanguage) {
    templateQuery = templateQuery.eq('language', templateLanguage);
  }
  const primary = await templateQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let rawTemplateRow: MessageTemplate | null = primary.data ?? null;
  if (!rawTemplateRow && templateLanguage) {
    const fallback = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('name', templateName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    rawTemplateRow = fallback.data ?? null;
  }

  if (rawTemplateRow && !isMessageTemplate(rawTemplateRow)) {
    throw new Error(
      'Template row is malformed — run "Sync from Meta" in Settings.',
    );
  }

  const metaTemplateLanguage =
    rawTemplateRow?.language || templateLanguage || 'en_US';
  const templateRow = rawTemplateRow ?? null;

  const results: BroadcastSendResult[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const sanitized = normalizeToInternational(
      recipient.phone,
      defaultCountryCode,
    );

    if (!isValidE164(sanitized)) {
      results.push({
        phone: recipient.phone,
        status: 'failed',
        error: 'Invalid phone number format',
      });
      continue;
    }

    const variants = phoneVariants(sanitized);
    let sentMessageId: string | null = null;
    let lastError: string | null = null;

    for (const variant of variants) {
      let variantSent = false;
      for (let attempt = 0; attempt < META_RATE_LIMIT_MAX_RETRIES; attempt++) {
        try {
          const result = await sendTemplateMessage({
            phoneNumberId: config.phone_number_id,
            accessToken,
            to: variant,
            templateName,
            language: metaTemplateLanguage,
            template: templateRow ?? undefined,
            params: recipient.params ?? [],
          });
          sentMessageId = result.messageId;
          lastError = null;
          variantSent = true;
          break;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          if (
            isMetaRateLimitError(errorMessage) &&
            attempt < META_RATE_LIMIT_MAX_RETRIES - 1
          ) {
            await sleep(1000 * (attempt + 1));
            continue;
          }
          if (!isRecipientNotAllowedError(errorMessage)) {
            lastError = errorMessage;
            break;
          }
          lastError = errorMessage;
          break;
        }
      }
      if (variantSent) break;
    }

    if (sentMessageId) {
      results.push({
        phone: recipient.phone,
        status: 'sent',
        whatsapp_message_id: sentMessageId,
      });
    } else {
      results.push({
        phone: recipient.phone,
        status: 'failed',
        error: lastError || 'Unknown error',
      });
    }

    if (i < recipients.length - 1) {
      await sleep(META_SEND_DELAY_MS);
    }
  }

  return results;
}
