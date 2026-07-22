import { randomUUID } from "crypto";

import { query } from "@/lib/mysql";
import { extractMergeTags } from "./merge";
import type { EmailTemplate } from "./types";

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseVariables(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return null;
    }
  }
  return null;
}

function mapTemplate(row: Record<string, unknown>): EmailTemplate {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    name: String(row.name),
    subject: String(row.subject),
    html_body: String(row.html_body),
    text_body: row.text_body ? String(row.text_body) : null,
    variables: parseVariables(row.variables),
    created_at: toIso(row.created_at) || new Date().toISOString(),
    updated_at: toIso(row.updated_at) || new Date().toISOString(),
  };
}

export const STARTER_TEMPLATE_HTML = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <h1 style="font-size:24px;margin:0 0 16px">Hello {{name}},</h1>
  <p style="font-size:16px;line-height:1.6;margin:0 0 16px">
    Thanks for being on our list. Here’s what’s new this week.
  </p>
  <p style="font-size:16px;line-height:1.6;margin:0 0 24px">
    — The team
  </p>
</div>`;

export async function listTemplates(
  accountId: string,
): Promise<EmailTemplate[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_templates WHERE account_id = ? ORDER BY updated_at DESC`,
    [accountId],
  );
  return rows.map(mapTemplate);
}

export async function getTemplate(
  accountId: string,
  templateId: string,
): Promise<EmailTemplate | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_templates WHERE id = ? AND account_id = ? LIMIT 1`,
    [templateId, accountId],
  );
  return rows[0] ? mapTemplate(rows[0]) : null;
}

export async function createTemplate(
  accountId: string,
  input: {
    name: string;
    subject: string;
    html_body: string;
    text_body?: string | null;
  },
): Promise<EmailTemplate> {
  const name = input.name.trim();
  const subject = input.subject.trim();
  const html = input.html_body.trim();
  if (!name || !subject || !html) {
    throw new Error("name, subject, and html_body are required");
  }
  const variables = extractMergeTags(`${subject}\n${html}`);
  const id = randomUUID();
  await query(
    `INSERT INTO email_templates
       (id, account_id, name, subject, html_body, text_body, variables)
     VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
    [
      id,
      accountId,
      name,
      subject,
      html,
      input.text_body?.trim() || null,
      JSON.stringify(variables),
    ],
  );
  const tpl = await getTemplate(accountId, id);
  if (!tpl) throw new Error("Failed to create template");
  return tpl;
}

export async function updateTemplate(
  accountId: string,
  templateId: string,
  input: {
    name?: string;
    subject?: string;
    html_body?: string;
    text_body?: string | null;
  },
): Promise<EmailTemplate> {
  const current = await getTemplate(accountId, templateId);
  if (!current) throw new Error("Template not found");

  const name = input.name?.trim() || current.name;
  const subject = input.subject?.trim() || current.subject;
  const html = input.html_body?.trim() || current.html_body;
  const text =
    input.text_body === undefined
      ? current.text_body
      : input.text_body?.trim() || null;
  const variables = extractMergeTags(`${subject}\n${html}`);

  await query(
    `UPDATE email_templates
     SET name = ?, subject = ?, html_body = ?, text_body = ?,
         variables = CAST(? AS JSON), updated_at = UTC_TIMESTAMP()
     WHERE id = ? AND account_id = ?`,
    [name, subject, html, text, JSON.stringify(variables), templateId, accountId],
  );
  const updated = await getTemplate(accountId, templateId);
  if (!updated) throw new Error("Template not found");
  return updated;
}

export async function deleteTemplate(
  accountId: string,
  templateId: string,
): Promise<void> {
  await query(`DELETE FROM email_templates WHERE id = ? AND account_id = ?`, [
    templateId,
    accountId,
  ]);
}
