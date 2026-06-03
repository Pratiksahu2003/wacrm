import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve the signed-in user's account_id from their profile row.
 * Use in client components / hooks that insert tenant-scoped rows
 * (contacts, broadcasts, etc.) — post-017 RLS checks account_id, not
 * user_id.
 */
export async function resolveClientAccountId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.account_id) {
    throw new Error('Could not load account context');
  }

  return data.account_id as string;
}
