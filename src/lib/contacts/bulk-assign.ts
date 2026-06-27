import type { SupabaseClient } from "@supabase/supabase-js";

/** Bulk-update lead owners and mirror onto open conversations. */
export async function bulkAssignContacts(
  supabase: SupabaseClient,
  contactIds: string[],
  assignedUserId: string | null,
): Promise<{ error: Error | null }> {
  if (contactIds.length === 0) {
    return { error: null };
  }

  const { error: contactError } = await supabase
    .from("contacts")
    .update({
      assigned_to: assignedUserId,
      updated_at: new Date().toISOString(),
    })
    .in("id", contactIds);

  if (contactError) {
    return { error: new Error(contactError.message) };
  }

  const { error: convError } = await supabase
    .from("conversations")
    .update({ assigned_agent_id: assignedUserId })
    .in("contact_id", contactIds)
    .in("status", ["open", "pending"]);

  if (convError) {
    return { error: new Error(convError.message) };
  }

  return { error: null };
}
