import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact } from '@/types';
import type { AudienceConfig } from './types';
import {
  fetchAllContactsForAccount,
  fetchContactIdsForCustomField,
  fetchContactIdsForTags,
  fetchContactsByIds,
} from './paginate-contacts';

const INSERT_CHUNK = 200;

/**
 * Resolve an audience config to contact rows. Runs server-side during
 * broadcast queue setup so the client can return immediately.
 *
 * All fetches are paginated — Supabase/PostgREST silently caps bare
 * `.select()` calls at 1 000 rows, which previously limited "All
 * Contacts" broadcasts to ~995 recipients even when 70k+ existed.
 */
export async function resolveBroadcastAudience(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  audience: AudienceConfig,
): Promise<Contact[]> {
  let contacts: Contact[] = [];

  if (audience.type === 'all') {
    contacts = await fetchAllContactsForAccount(supabase, accountId);
  } else if (
    audience.type === 'tags' &&
    audience.tagIds &&
    audience.tagIds.length > 0
  ) {
    const uniqueContactIds = [
      ...await fetchContactIdsForTags(supabase, audience.tagIds),
    ];
    if (uniqueContactIds.length > 0) {
      contacts = await fetchContactsByIds(supabase, uniqueContactIds);
    }
  } else if (audience.type === 'custom_field' && audience.customField) {
    contacts = await resolveCustomFieldAudience(supabase, audience.customField);
  } else if (audience.type === 'csv' && audience.csvContacts) {
    contacts = await upsertCsvContacts(
      supabase,
      accountId,
      userId,
      audience.csvContacts,
    );
  }

  if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
    const excludedIds = await fetchContactIdsForTags(
      supabase,
      audience.excludeTagIds,
    );
    contacts = contacts.filter((c) => !excludedIds.has(c.id));
  }

  return contacts;
}

async function upsertCsvContacts(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  csvRows: { phone: string; name?: string }[],
): Promise<Contact[]> {
  if (csvRows.length === 0) return [];

  const uniqueByPhone = new Map<string, { phone: string; name?: string }>();
  for (const row of csvRows) {
    if (row.phone) uniqueByPhone.set(row.phone, row);
  }
  const phones = [...uniqueByPhone.keys()];

  const byPhone = new Map<string, Contact>();

  for (let i = 0; i < phones.length; i += 500) {
    const phoneSlice = phones.slice(i, i + 500);
    const { data: existing, error: lookupErr } = await supabase
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .in('phone', phoneSlice);
    if (lookupErr) {
      throw new Error(`Failed to look up CSV contacts: ${lookupErr.message}`);
    }
    for (const c of (existing ?? []) as Contact[]) {
      if (c.phone) byPhone.set(c.phone, c);
    }
  }

  const missing = phones
    .filter((p) => !byPhone.has(p))
    .map((phone) => ({
      account_id: accountId,
      user_id: userId,
      phone,
      name: uniqueByPhone.get(phone)?.name ?? null,
    }));

  for (let i = 0; i < missing.length; i += INSERT_CHUNK) {
    const chunk = missing.slice(i, i + INSERT_CHUNK);
    const { data: inserted, error: insertErr } = await supabase
      .from('contacts')
      .insert(chunk)
      .select();
    if (insertErr) {
      throw new Error(`Failed to create CSV contacts: ${insertErr.message}`);
    }
    for (const c of (inserted ?? []) as Contact[]) {
      if (c.phone) byPhone.set(c.phone, c);
    }
  }

  return phones
    .map((p) => byPhone.get(p))
    .filter((c): c is Contact => Boolean(c));
}

async function resolveCustomFieldAudience(
  supabase: SupabaseClient,
  filter: AudienceConfig['customField'] & object,
): Promise<Contact[]> {
  const { fieldId, operator, value } = filter;

  const contactIds = await fetchContactIdsForCustomField(
    supabase,
    fieldId,
    operator,
    value,
  );
  if (contactIds.length === 0) return [];

  return fetchContactsByIds(supabase, contactIds);
}
