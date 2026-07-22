import { supabaseAdmin } from '@/lib/automations/admin-client';
import type { Contact } from '@/types';
import { resolveVariables } from './resolve-variables';
import { sendTemplateBatch } from './send-batch';
import { triggerBroadcastProcessingHttp } from './trigger';
import type { VariableMapping } from './types';

const SEND_BATCH_SIZE = 5;
const SEND_BATCH_DELAY_MS = 2000;
const INSERT_BATCH_SIZE = 200;

/** In-flight guard — one processor per broadcast per Node process. */
const activeBroadcasts = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CustomValueIndex = Map<string, Map<string, string>>;

async function fetchCustomValueIndex(
  contactIds: string[],
): Promise<CustomValueIndex> {
  const admin = supabaseAdmin();
  const index: CustomValueIndex = new Map();
  if (contactIds.length === 0) return index;

  const PAGE = 500;
  for (let i = 0; i < contactIds.length; i += PAGE) {
    const slice = contactIds.slice(i, i + PAGE);
    const { data } = await admin
      .from('contact_custom_values')
      .select('contact_id, custom_field_id, value')
      .in('contact_id', slice);

    for (const row of data ?? []) {
      const bucket = index.get(row.contact_id) ?? new Map<string, string>();
      bucket.set(row.custom_field_id, row.value ?? '');
      index.set(row.contact_id, bucket);
    }
  }
  return index;
}

interface PendingRecipientRow {
  id: string;
  contact: Contact | Contact[] | null;
}

function asContact(
  contact: Contact | Contact[] | null | undefined,
): Contact | null {
  if (!contact) return null;
  if (Array.isArray(contact)) return contact[0] ?? null;
  return contact;
}

/**
 * Drain pending recipients for a broadcast until none remain, then
 * finalize status. Safe to call from the start route (fire-and-forget)
 * or the cron sweeper (resume stalled sends).
 */
export async function processBroadcast(broadcastId: string): Promise<void> {
  if (activeBroadcasts.has(broadcastId)) return;
  activeBroadcasts.add(broadcastId);

  const admin = supabaseAdmin();

  try {
    const { data: broadcast, error: bcError } = await admin
      .from('broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .maybeSingle();

    if (bcError || !broadcast) {
      console.error(`[broadcast-processor] broadcast ${broadcastId} not found`);
      return;
    }

    if (broadcast.status !== 'sending') return;

    const accountId = broadcast.account_id as string;
    const variables = (broadcast.template_variables ??
      {}) as Record<string, VariableMapping>;

    let customValueIndex: CustomValueIndex | null = null;

    while (true) {
      const { data: pending, error: pendingError } = await admin
        .from('broadcast_recipients')
        .select('id, contact:contacts(*)')
        .eq('broadcast_id', broadcastId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(SEND_BATCH_SIZE);

      if (pendingError) {
        console.error(
          `[broadcast-processor] pending fetch failed for ${broadcastId}:`,
          pendingError.message,
        );
        break;
      }

      const batch = (pending ?? []) as PendingRecipientRow[];
      if (batch.length === 0) break;

      // Defense-in-depth: skip contacts that opted out after queueing.
      for (const recipient of batch) {
        const contact = asContact(recipient.contact);
        const optedOut =
          Boolean(contact?.opted_out) || Number(contact?.opted_out) === 1;
        if (optedOut) {
          await admin
            .from('broadcast_recipients')
            .update({
              status: 'failed',
              error_message: 'Skipped: contact opted out (DND)',
            })
            .eq('id', recipient.id);
        }
      }

      const eligibleBatch = batch.filter((r) => {
        const contact = asContact(r.contact);
        return !(
          Boolean(contact?.opted_out) || Number(contact?.opted_out) === 1
        );
      });
      if (eligibleBatch.length === 0) {
        await sleep(SEND_BATCH_DELAY_MS);
        continue;
      }

      if (!customValueIndex) {
        const { data: allPending } = await admin
          .from('broadcast_recipients')
          .select('contact_id')
          .eq('broadcast_id', broadcastId)
          .eq('status', 'pending');
        const contactIds = [
          ...new Set(
            (allPending ?? [])
              .map((r) => r.contact_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        customValueIndex = await fetchCustomValueIndex(contactIds);
      }

      const apiRecipients = eligibleBatch
        .map((r) => ({ row: r, contact: asContact(r.contact) }))
        .filter((r) => r.contact?.phone)
        .map((r) => ({
          phone: r.contact!.phone as string,
          params: r.contact
            ? resolveVariables(
                variables,
                r.contact,
                customValueIndex!.get(r.contact.id),
              )
            : [],
        }));

      let resultsByPhone = new Map<
        string,
        { status: 'sent' | 'failed'; whatsapp_message_id?: string; error?: string }
      >();

      if (apiRecipients.length > 0) {
        try {
          const results = await sendTemplateBatch({
            supabase: admin,
            accountId,
            templateName: broadcast.template_name,
            templateLanguage: broadcast.template_language,
            recipients: apiRecipients,
          });
          resultsByPhone = new Map(results.map((r) => [r.phone, r]));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Send batch failed';
          for (const recipient of eligibleBatch) {
            await admin
              .from('broadcast_recipients')
              .update({ status: 'failed', error_message: message })
              .eq('id', recipient.id);
          }
          await sleep(SEND_BATCH_DELAY_MS);
          continue;
        }
      }

      for (const recipient of eligibleBatch) {
        const contact = asContact(recipient.contact);
        const phone = contact?.phone;
        const result = phone ? resultsByPhone.get(phone) : undefined;

        if (!result) {
          await admin
            .from('broadcast_recipients')
            .update({
              status: 'failed',
              error_message: 'No phone number on contact',
            })
            .eq('id', recipient.id);
          continue;
        }

        if (result.status === 'sent') {
          await admin
            .from('broadcast_recipients')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              whatsapp_message_id: result.whatsapp_message_id ?? null,
              error_message: null,
            })
            .eq('id', recipient.id);
        } else {
          await admin
            .from('broadcast_recipients')
            .update({
              status: 'failed',
              error_message: result.error ?? 'Unknown error',
            })
            .eq('id', recipient.id);
        }
      }

      await sleep(SEND_BATCH_DELAY_MS);
    }

    const { count: pendingCount } = await admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .eq('status', 'pending');

    if ((pendingCount ?? 0) > 0) {
      triggerBroadcastProcessingHttp(broadcastId);
      return;
    }

    const { count: failedCount } = await admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .eq('status', 'failed');

    const { count: totalCount } = await admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId);

    const finalStatus =
      (failedCount ?? 0) === (totalCount ?? 0) && (totalCount ?? 0) > 0
        ? 'failed'
        : 'sent';

    await admin
      .from('broadcasts')
      .update({ status: finalStatus })
      .eq('id', broadcastId)
      .eq('status', 'sending');
  } catch (err) {
    console.error(`[broadcast-processor] fatal error for ${broadcastId}:`, err);
  } finally {
    activeBroadcasts.delete(broadcastId);
  }
}

export { INSERT_BATCH_SIZE };
