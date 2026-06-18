import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact } from '@/types';

/** PostgREST default max rows per request. */
const PAGE_SIZE = 1000;

/** Safe IN-clause chunk size for `.in('id', …)` lookups. */
const IN_CHUNK = 500;

/**
 * Page through a Supabase query until all rows are collected.
 */
async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

/**
 * Fetch every contact for an account (no 1 000-row cap).
 */
export async function fetchAllContactsForAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Contact[]> {
  return fetchAllPages<Contact>(async (from, to) =>
    await supabase
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/**
 * Fetch contacts by id in chunks (supports 70k+ audiences).
 */
export async function fetchContactsByIds(
  supabase: SupabaseClient,
  contactIds: string[],
): Promise<Contact[]> {
  if (contactIds.length === 0) return [];

  const contacts: Contact[] = [];
  for (let i = 0; i < contactIds.length; i += IN_CHUNK) {
    const slice = contactIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .in('id', slice);
    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }
    contacts.push(...((data ?? []) as Contact[]));
  }
  return contacts;
}

/**
 * Collect all contact_ids linked to any of the given tags (paginated).
 */
export async function fetchContactIdsForTags(
  supabase: SupabaseClient,
  tagIds: string[],
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (tagIds.length === 0) return ids;

  const rows = await fetchAllPages<{ contact_id: string }>(async (from, to) =>
    await supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', tagIds)
      .order('contact_id', { ascending: true })
      .range(from, to),
  );

  for (const row of rows) {
    ids.add(row.contact_id);
  }
  return ids;
}

/**
 * Paginated fetch of contact_id rows from contact_custom_values.
 */
export async function fetchContactIdsForCustomField(
  supabase: SupabaseClient,
  fieldId: string,
  operator: 'is' | 'is_not' | 'contains',
  value: string,
): Promise<string[]> {
  const ids = new Set<string>();

  const rows = await fetchAllPages<{ contact_id: string }>(async (from, to) => {
    let query = supabase
      .from('contact_custom_values')
      .select('contact_id')
      .eq('custom_field_id', fieldId);

    if (operator === 'is') query = query.eq('value', value);
    else if (operator === 'is_not') query = query.neq('value', value);
    else if (operator === 'contains') query = query.ilike('value', `%${value}%`);

    return await query.order('contact_id', { ascending: true }).range(from, to);
  });

  for (const row of rows) {
    ids.add(row.contact_id);
  }
  return [...ids];
}
