import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When a contact's lead owner changes, mirror it onto open conversations
 * so the inbox assignee stays in sync.
 */
export async function syncConversationAssigneeForContact(
  supabase: SupabaseClient,
  contactId: string,
  assignedUserId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ assigned_agent_id: assignedUserId })
    .eq("contact_id", contactId)
    .in("status", ["open", "pending"]);

  if (error) {
    console.error("Failed to sync conversation assignee:", error);
  }
}
