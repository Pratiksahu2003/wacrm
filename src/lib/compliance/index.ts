import { randomUUID } from "crypto";

import { query } from "@/lib/mysql";

export const DEFAULT_OPT_OUT_KEYWORDS = [
  "STOP",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
];
export const DEFAULT_OPT_IN_KEYWORDS = ["START", "SUBSCRIBE", "YES", "UNSTOP"];

export const DEFAULT_OPT_OUT_REPLY =
  "You’re unsubscribed from marketing messages. Reply START anytime to opt back in.";
export const DEFAULT_OPT_IN_REPLY =
  "You’re subscribed again. Reply STOP anytime to opt out of marketing messages.";

export interface ComplianceSettings {
  account_id: string;
  opt_out_keywords: string[];
  opt_in_keywords: string[];
  opt_out_reply: string;
  opt_in_reply: string;
  auto_reply_enabled: boolean;
  exclude_from_broadcasts: boolean;
}

export interface AuditLogRow {
  id: string;
  account_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

function parseKeywordList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) {
    return raw.map((k) => String(k).trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((k) => String(k).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter(Boolean);
    }
  }
  return [...fallback];
}

function rowToSettings(row: Record<string, unknown>): ComplianceSettings {
  return {
    account_id: String(row.account_id),
    opt_out_keywords: parseKeywordList(
      row.opt_out_keywords,
      DEFAULT_OPT_OUT_KEYWORDS,
    ),
    opt_in_keywords: parseKeywordList(
      row.opt_in_keywords,
      DEFAULT_OPT_IN_KEYWORDS,
    ),
    opt_out_reply:
      (typeof row.opt_out_reply === "string" && row.opt_out_reply.trim()) ||
      DEFAULT_OPT_OUT_REPLY,
    opt_in_reply:
      (typeof row.opt_in_reply === "string" && row.opt_in_reply.trim()) ||
      DEFAULT_OPT_IN_REPLY,
    auto_reply_enabled: Number(row.auto_reply_enabled ?? 1) === 1,
    exclude_from_broadcasts: Number(row.exclude_from_broadcasts ?? 1) === 1,
  };
}

export function defaultComplianceSettings(
  accountId: string,
): ComplianceSettings {
  return {
    account_id: accountId,
    opt_out_keywords: [...DEFAULT_OPT_OUT_KEYWORDS],
    opt_in_keywords: [...DEFAULT_OPT_IN_KEYWORDS],
    opt_out_reply: DEFAULT_OPT_OUT_REPLY,
    opt_in_reply: DEFAULT_OPT_IN_REPLY,
    auto_reply_enabled: true,
    exclude_from_broadcasts: true,
  };
}

export async function getComplianceSettings(
  accountId: string,
): Promise<ComplianceSettings> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT account_id, opt_out_keywords, opt_in_keywords, opt_out_reply,
              opt_in_reply, auto_reply_enabled, exclude_from_broadcasts
       FROM account_compliance_settings
       WHERE account_id = ?
       LIMIT 1`,
      [accountId],
    );
    if (rows[0]) return rowToSettings(rows[0]);
  } catch (err) {
    console.warn("[compliance] getComplianceSettings:", err);
  }
  return defaultComplianceSettings(accountId);
}

export async function upsertComplianceSettings(
  accountId: string,
  input: Partial<Omit<ComplianceSettings, "account_id">>,
): Promise<ComplianceSettings> {
  const current = await getComplianceSettings(accountId);
  const next: ComplianceSettings = {
    account_id: accountId,
    opt_out_keywords:
      input.opt_out_keywords ?? current.opt_out_keywords,
    opt_in_keywords: input.opt_in_keywords ?? current.opt_in_keywords,
    opt_out_reply: input.opt_out_reply ?? current.opt_out_reply,
    opt_in_reply: input.opt_in_reply ?? current.opt_in_reply,
    auto_reply_enabled:
      typeof input.auto_reply_enabled === "boolean"
        ? input.auto_reply_enabled
        : current.auto_reply_enabled,
    exclude_from_broadcasts:
      typeof input.exclude_from_broadcasts === "boolean"
        ? input.exclude_from_broadcasts
        : current.exclude_from_broadcasts,
  };

  await query(
    `INSERT INTO account_compliance_settings
       (account_id, opt_out_keywords, opt_in_keywords, opt_out_reply, opt_in_reply,
        auto_reply_enabled, exclude_from_broadcasts, updated_at)
     VALUES (?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       opt_out_keywords = VALUES(opt_out_keywords),
       opt_in_keywords = VALUES(opt_in_keywords),
       opt_out_reply = VALUES(opt_out_reply),
       opt_in_reply = VALUES(opt_in_reply),
       auto_reply_enabled = VALUES(auto_reply_enabled),
       exclude_from_broadcasts = VALUES(exclude_from_broadcasts),
       updated_at = UTC_TIMESTAMP()`,
    [
      accountId,
      JSON.stringify(next.opt_out_keywords),
      JSON.stringify(next.opt_in_keywords),
      next.opt_out_reply,
      next.opt_in_reply,
      next.auto_reply_enabled ? 1 : 0,
      next.exclude_from_broadcasts ? 1 : 0,
    ],
  );

  return next;
}

export async function writeAuditLog(input: {
  accountId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log
         (id, account_id, actor_user_id, action, entity_type, entity_id, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), UTC_TIMESTAMP())`,
      [
        randomUUID(),
        input.accountId,
        input.actorUserId ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.meta ?? {}),
      ],
    );
  } catch (err) {
    console.warn("[compliance] writeAuditLog:", err);
  }
}

export async function listAuditLogs(
  accountId: string,
  limit = 50,
): Promise<AuditLogRow[]> {
  // mysql2 prepared statements reject LIMIT ? on some servers (ER_WRONG_ARGUMENTS).
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 50), 1), 200);
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, account_id, actor_user_id, action, entity_type, entity_id, meta, created_at
       FROM audit_log
       WHERE account_id = ?
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
      [accountId],
    );

    return rows.map((row) => {
      let meta: Record<string, unknown> | null = null;
      if (row.meta && typeof row.meta === "object") {
        meta = row.meta as Record<string, unknown>;
      } else if (typeof row.meta === "string") {
        try {
          meta = JSON.parse(row.meta) as Record<string, unknown>;
        } catch {
          meta = null;
        }
      }
      return {
        id: String(row.id),
        account_id: String(row.account_id),
        actor_user_id: row.actor_user_id ? String(row.actor_user_id) : null,
        action: String(row.action),
        entity_type: String(row.entity_type),
        entity_id: row.entity_id ? String(row.entity_id) : null,
        meta,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
      };
    });
  } catch (err) {
    console.warn("[compliance] listAuditLogs:", err);
    return [];
  }
}

/** Exact keyword match (case-insensitive), whole message trimmed. */
export function matchComplianceKeyword(
  text: string,
  keywords: string[],
): string | null {
  const normalized = text.trim().toUpperCase();
  if (!normalized) return null;
  for (const keyword of keywords) {
    const k = keyword.trim().toUpperCase();
    if (k && normalized === k) return keyword.trim();
  }
  return null;
}

export async function setContactOptOut(input: {
  accountId: string;
  contactId: string;
  optedOut: boolean;
  source: string;
  actorUserId?: string | null;
  keyword?: string | null;
}): Promise<void> {
  await query(
    `UPDATE contacts
     SET opted_out = ?,
         opted_out_at = CASE WHEN ? = 1 THEN UTC_TIMESTAMP() ELSE NULL END,
         opt_out_source = CASE WHEN ? = 1 THEN ? ELSE NULL END,
         updated_at = UTC_TIMESTAMP()
     WHERE id = ? AND account_id = ?`,
    [
      input.optedOut ? 1 : 0,
      input.optedOut ? 1 : 0,
      input.optedOut ? 1 : 0,
      input.source,
      input.contactId,
      input.accountId,
    ],
  );

  await writeAuditLog({
    accountId: input.accountId,
    actorUserId: input.actorUserId ?? null,
    action: input.optedOut ? "contact.opt_out" : "contact.opt_in",
    entityType: "contact",
    entityId: input.contactId,
    meta: {
      source: input.source,
      keyword: input.keyword ?? null,
    },
  });
}

export async function countOptedOutContacts(
  accountId: string,
): Promise<number> {
  try {
    const rows = await query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM contacts WHERE account_id = ? AND opted_out = 1`,
      [accountId],
    );
    return Number(rows[0]?.c ?? 0);
  } catch (err) {
    console.warn("[compliance] countOptedOutContacts:", err);
    return 0;
  }
}

export async function listOptedOutContacts(
  accountId: string,
  limit = 100,
): Promise<
  Array<{
    id: string;
    name: string | null;
    phone: string;
    opted_out_at: string | null;
    opt_out_source: string | null;
  }>
> {
  // mysql2 prepared statements reject LIMIT ? on some servers (ER_WRONG_ARGUMENTS).
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || 100), 1), 500);
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, phone, opted_out_at, opt_out_source
       FROM contacts
       WHERE account_id = ? AND opted_out = 1
       ORDER BY opted_out_at DESC
       LIMIT ${safeLimit}`,
      [accountId],
    );

    return rows.map((row) => ({
      id: String(row.id),
      name: row.name ? String(row.name) : null,
      phone: String(row.phone),
      opted_out_at: row.opted_out_at
        ? row.opted_out_at instanceof Date
          ? row.opted_out_at.toISOString()
          : String(row.opted_out_at)
        : null,
      opt_out_source: row.opt_out_source ? String(row.opt_out_source) : null,
    }));
  } catch (err) {
    console.warn("[compliance] listOptedOutContacts:", err);
    return [];
  }
}

/**
 * Handle inbound STOP/START. Returns whether the message was a compliance
 * keyword (caller should skip marketing automations for opt-out).
 */
export async function handleInboundComplianceKeyword(input: {
  accountId: string;
  contactId: string;
  phone: string;
  messageText: string;
  phoneNumberId: string;
  accessToken: string;
}): Promise<{ handled: boolean; action: "opt_out" | "opt_in" | null }> {
  const settings = await getComplianceSettings(input.accountId);
  const text = input.messageText || "";

  const optOutHit = matchComplianceKeyword(text, settings.opt_out_keywords);
  const optInHit = !optOutHit
    ? matchComplianceKeyword(text, settings.opt_in_keywords)
    : null;

  if (!optOutHit && !optInHit) {
    return { handled: false, action: null };
  }

  const optedOut = Boolean(optOutHit);
  await setContactOptOut({
    accountId: input.accountId,
    contactId: input.contactId,
    optedOut,
    source: "keyword",
    keyword: optOutHit || optInHit,
  });

  if (settings.auto_reply_enabled) {
    try {
      const { sendTextMessage } = await import("@/lib/whatsapp/meta-api");
      await sendTextMessage({
        phoneNumberId: input.phoneNumberId,
        accessToken: input.accessToken,
        to: input.phone,
        text: optedOut ? settings.opt_out_reply : settings.opt_in_reply,
      });
    } catch (err) {
      console.error("[compliance] auto-reply failed:", err);
    }
  }

  return {
    handled: true,
    action: optedOut ? "opt_out" : "opt_in",
  };
}
