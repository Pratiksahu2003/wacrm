import { randomBytes, randomUUID } from "crypto";

import { query } from "@/lib/mysql";
import type {
  EmailList,
  EmailSubscriber,
  SubscriberSource,
  SubscriberStatus,
} from "./types";

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `list-${randomBytes(3).toString("hex")}`;
}

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

function mapList(row: Record<string, unknown>): EmailList {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    public_slug: String(row.public_slug),
    double_opt_in: Number(row.double_opt_in) === 1,
    subscriber_count: Number(row.subscriber_count ?? 0),
    created_at: toIso(row.created_at) || new Date().toISOString(),
    updated_at: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function mapSubscriber(row: Record<string, unknown>): EmailSubscriber {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    list_id: String(row.list_id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    status: String(row.status) as SubscriberStatus,
    source: String(row.source) as SubscriberSource,
    subscribed_at: toIso(row.subscribed_at) || new Date().toISOString(),
    unsubscribed_at: toIso(row.unsubscribed_at),
    created_at: toIso(row.created_at) || new Date().toISOString(),
  };
}

export async function refreshListSubscriberCount(listId: string): Promise<void> {
  await query(
    `UPDATE email_lists
     SET subscriber_count = (
       SELECT COUNT(*) FROM email_subscribers
       WHERE list_id = ? AND status = 'subscribed'
     ),
     updated_at = UTC_TIMESTAMP()
     WHERE id = ?`,
    [listId, listId],
  );
}

export async function listEmailLists(accountId: string): Promise<EmailList[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_lists WHERE account_id = ? ORDER BY created_at DESC`,
    [accountId],
  );
  return rows.map(mapList);
}

export async function getEmailList(
  accountId: string,
  listId: string,
): Promise<EmailList | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_lists WHERE id = ? AND account_id = ? LIMIT 1`,
    [listId, accountId],
  );
  return rows[0] ? mapList(rows[0]) : null;
}

export async function getEmailListBySlug(
  slug: string,
): Promise<EmailList | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_lists WHERE public_slug = ? LIMIT 1`,
    [slug],
  );
  return rows[0] ? mapList(rows[0]) : null;
}

export async function createEmailList(
  accountId: string,
  input: { name: string; description?: string | null; public_slug?: string },
): Promise<EmailList> {
  const name = input.name.trim();
  if (!name) throw new Error("List name is required");

  let slug = slugify(input.public_slug?.trim() || name);
  // Ensure unique slug per account
  for (let i = 0; i < 5; i++) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM email_lists WHERE account_id = ? AND public_slug = ? LIMIT 1`,
      [accountId, slug],
    );
    if (!existing[0]) break;
    slug = `${slugify(name)}-${randomBytes(2).toString("hex")}`;
  }

  const id = randomUUID();
  await query(
    `INSERT INTO email_lists
       (id, account_id, name, description, public_slug, double_opt_in, subscriber_count)
     VALUES (?, ?, ?, ?, ?, 0, 0)`,
    [id, accountId, name, input.description?.trim() || null, slug],
  );
  const list = await getEmailList(accountId, id);
  if (!list) throw new Error("Failed to create list");
  return list;
}

export async function updateEmailList(
  accountId: string,
  listId: string,
  input: { name?: string; description?: string | null },
): Promise<EmailList> {
  const current = await getEmailList(accountId, listId);
  if (!current) throw new Error("List not found");

  const name = input.name?.trim() || current.name;
  const description =
    input.description === undefined
      ? current.description
      : input.description?.trim() || null;

  await query(
    `UPDATE email_lists
     SET name = ?, description = ?, updated_at = UTC_TIMESTAMP()
     WHERE id = ? AND account_id = ?`,
    [name, description, listId, accountId],
  );
  const updated = await getEmailList(accountId, listId);
  if (!updated) throw new Error("List not found");
  return updated;
}

export async function deleteEmailList(
  accountId: string,
  listId: string,
): Promise<void> {
  const campaigns = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM email_campaigns
     WHERE list_id = ? AND account_id = ? AND status IN ('sending', 'scheduled')`,
    [listId, accountId],
  );
  if (Number(campaigns[0]?.c ?? 0) > 0) {
    throw new Error("Cannot delete a list used by an active campaign");
  }
  await query(`DELETE FROM email_lists WHERE id = ? AND account_id = ?`, [
    listId,
    accountId,
  ]);
}

export async function listSubscribers(
  accountId: string,
  listId: string,
  opts?: { status?: SubscriberStatus; limit?: number; offset?: number },
): Promise<EmailSubscriber[]> {
  const safeLimit = Math.min(Math.max(Math.floor(opts?.limit ?? 100), 1), 500);
  const safeOffset = Math.max(Math.floor(opts?.offset ?? 0), 0);
  const status = opts?.status;

  const rows = status
    ? await query<Record<string, unknown>>(
        `SELECT * FROM email_subscribers
         WHERE account_id = ? AND list_id = ? AND status = ?
         ORDER BY created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [accountId, listId, status],
      )
    : await query<Record<string, unknown>>(
        `SELECT * FROM email_subscribers
         WHERE account_id = ? AND list_id = ?
         ORDER BY created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [accountId, listId],
      );
  return rows.map(mapSubscriber);
}

export async function addSubscriber(input: {
  accountId: string;
  listId: string;
  email: string;
  name?: string | null;
  source: SubscriberSource;
  /** When true, allow unsubscribed → subscribed again. */
  allowReoptIn?: boolean;
}): Promise<{ subscriber: EmailSubscriber; created: boolean; skipped?: string }> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw new Error(`Invalid email: ${input.email}`);
  }

  const list = await getEmailList(input.accountId, input.listId);
  if (!list) throw new Error("List not found");

  const existing = await query<Record<string, unknown>>(
    `SELECT * FROM email_subscribers WHERE list_id = ? AND email = ? LIMIT 1`,
    [input.listId, email],
  );

  if (existing[0]) {
    const row = mapSubscriber(existing[0]);
    if (row.status === "subscribed") {
      return { subscriber: row, created: false, skipped: "already_subscribed" };
    }
    if (row.status === "unsubscribed" && !input.allowReoptIn) {
      return { subscriber: row, created: false, skipped: "unsubscribed" };
    }
    await query(
      `UPDATE email_subscribers
       SET status = 'subscribed',
           name = COALESCE(?, name),
           source = ?,
           subscribed_at = UTC_TIMESTAMP(),
           unsubscribed_at = NULL,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [input.name?.trim() || null, input.source, row.id],
    );
    await refreshListSubscriberCount(input.listId);
    const updated = await query<Record<string, unknown>>(
      `SELECT * FROM email_subscribers WHERE id = ? LIMIT 1`,
      [row.id],
    );
    return { subscriber: mapSubscriber(updated[0]!), created: false };
  }

  const id = randomUUID();
  const token = newToken();
  await query(
    `INSERT INTO email_subscribers
       (id, account_id, list_id, email, name, status, source, unsubscribe_token)
     VALUES (?, ?, ?, ?, ?, 'subscribed', ?, ?)`,
    [
      id,
      input.accountId,
      input.listId,
      email,
      input.name?.trim() || null,
      input.source,
      token,
    ],
  );
  await refreshListSubscriberCount(input.listId);
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_subscribers WHERE id = ? LIMIT 1`,
    [id],
  );
  return { subscriber: mapSubscriber(rows[0]!), created: true };
}

export async function importCsvSubscribers(input: {
  accountId: string;
  listId: string;
  csvText: string;
}): Promise<{ added: number; skipped: number; invalid: number }> {
  const lines = input.csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { added: 0, skipped: 0, invalid: 0 };
  }

  let start = 0;
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("email");
  if (hasHeader) start = 1;

  let added = 0;
  let skipped = 0;
  let invalid = 0;

  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    let email = "";
    let name: string | null = null;

    if (hasHeader) {
      const cols = header.split(",").map((c) => c.trim().toLowerCase());
      const emailIdx = cols.findIndex((c) => c === "email");
      const nameIdx = cols.findIndex((c) => c === "name");
      email = parts[emailIdx] || "";
      name = nameIdx >= 0 ? parts[nameIdx] || null : null;
    } else {
      email = parts[0] || "";
      name = parts[1] || null;
    }

    if (!isValidEmail(email)) {
      invalid++;
      continue;
    }

    try {
      const result = await addSubscriber({
        accountId: input.accountId,
        listId: input.listId,
        email,
        name,
        source: "csv",
        allowReoptIn: false,
      });
      if (result.created) added++;
      else skipped++;
    } catch {
      invalid++;
    }
  }

  return { added, skipped, invalid };
}

export async function unsubscribeByToken(
  token: string,
): Promise<{ ok: boolean; email?: string; listName?: string; error?: string }> {
  const rows = await query<Record<string, unknown>>(
    `SELECT s.*, l.name AS list_name
     FROM email_subscribers s
     JOIN email_lists l ON l.id = s.list_id
     WHERE s.unsubscribe_token = ?
     LIMIT 1`,
    [token],
  );
  if (!rows[0]) return { ok: false, error: "Invalid unsubscribe link" };

  const id = String(rows[0].id);
  const listId = String(rows[0].list_id);
  await query(
    `UPDATE email_subscribers
     SET status = 'unsubscribed',
         unsubscribed_at = UTC_TIMESTAMP(),
         updated_at = UTC_TIMESTAMP()
     WHERE id = ?`,
    [id],
  );
  await refreshListSubscriberCount(listId);
  return {
    ok: true,
    email: String(rows[0].email),
    listName: String(rows[0].list_name),
  };
}

export async function getSubscriberByToken(token: string): Promise<{
  subscriber: EmailSubscriber;
  list: EmailList;
  unsubscribe_token: string;
} | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT s.*, l.name AS list_name, l.public_slug, l.description AS list_description,
            l.double_opt_in, l.subscriber_count, l.created_at AS list_created_at,
            l.updated_at AS list_updated_at, l.account_id AS list_account_id
     FROM email_subscribers s
     JOIN email_lists l ON l.id = s.list_id
     WHERE s.unsubscribe_token = ?
     LIMIT 1`,
    [token],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    subscriber: mapSubscriber(row),
    list: {
      id: String(row.list_id),
      account_id: String(row.list_account_id || row.account_id),
      name: String(row.list_name),
      description: row.list_description ? String(row.list_description) : null,
      public_slug: String(row.public_slug),
      double_opt_in: Number(row.double_opt_in) === 1,
      subscriber_count: Number(row.subscriber_count ?? 0),
      created_at: toIso(row.list_created_at) || new Date().toISOString(),
      updated_at: toIso(row.list_updated_at) || new Date().toISOString(),
    },
    unsubscribe_token: String(row.unsubscribe_token),
  };
}

export async function countAccountSubscribers(
  accountId: string,
): Promise<number> {
  const rows = await query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM email_subscribers
     WHERE account_id = ? AND status = 'subscribed'`,
    [accountId],
  );
  return Number(rows[0]?.c ?? 0);
}
