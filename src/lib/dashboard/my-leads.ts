import type { SupabaseClient } from "@supabase/supabase-js";

export interface MyLeadItem {
  id: string;
  kind: "contact" | "conversation" | "deal";
  title: string;
  subtitle?: string;
  href: string;
  at: string;
}

export interface MyLeadsSummary {
  contactCount: number;
  conversationCount: number;
  dealCount: number;
  recent: MyLeadItem[];
}

type DB = SupabaseClient;

/** Assigned leads/conversations/deals for the signed-in teammate. */
export async function loadMyLeads(
  db: DB,
  userId: string,
): Promise<MyLeadsSummary> {
  const [
    contactsCount,
    convCount,
    dealsCount,
    contactsRecent,
    convRecent,
    dealsRecent,
  ] = await Promise.all([
    db
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId),
    db
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("assigned_agent_id", userId)
      .in("status", ["open", "pending"]),
    db
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "open"),
    db
      .from("contacts")
      .select("id, name, phone, updated_at")
      .eq("assigned_to", userId)
      .order("updated_at", { ascending: false })
      .limit(5),
    db
      .from("conversations")
      .select(
        "id, last_message_at, last_message_text, contact:contacts(name, phone)",
      )
      .eq("assigned_agent_id", userId)
      .in("status", ["open", "pending"])
      .order("last_message_at", { ascending: false })
      .limit(5),
    db
      .from("deals")
      .select("id, title, value, currency, updated_at")
      .eq("assigned_to", userId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const recent: MyLeadItem[] = [];

  for (const c of (contactsRecent.data ?? []) as Array<{
    id: string;
    name: string | null;
    phone: string;
    updated_at: string;
  }>) {
    recent.push({
      id: `contact-${c.id}`,
      kind: "contact",
      title: c.name || c.phone,
      subtitle: "Contact",
      href: `/contacts?assign=mine`,
      at: c.updated_at,
    });
  }

  for (const conv of (convRecent.data ?? []) as unknown as Array<{
    id: string;
    last_message_at: string | null;
    last_message_text: string | null;
    contact:
      | { name: string | null; phone: string }[]
      | { name: string | null; phone: string }
      | null;
  }>) {
    const contact = Array.isArray(conv.contact) ? conv.contact[0] : conv.contact;
    const who = contact?.name || contact?.phone || "Chat";
    recent.push({
      id: `conv-${conv.id}`,
      kind: "conversation",
      title: who,
      subtitle: conv.last_message_text || "Conversation",
      href: `/inbox?c=${conv.id}`,
      at: conv.last_message_at ?? new Date().toISOString(),
    });
  }

  for (const d of (dealsRecent.data ?? []) as Array<{
    id: string;
    title: string;
    value: number | null;
    currency: string | null;
    updated_at: string;
  }>) {
    recent.push({
      id: `deal-${d.id}`,
      kind: "deal",
      title: d.title,
      subtitle: "Open deal",
      href: "/pipelines",
      at: d.updated_at,
    });
  }

  recent.sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));

  return {
    contactCount: contactsCount.count ?? 0,
    conversationCount: convCount.count ?? 0,
    dealCount: dealsCount.count ?? 0,
    recent: recent.slice(0, 8),
  };
}
