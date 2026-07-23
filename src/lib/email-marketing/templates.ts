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

export type StarterEmailTemplate = {
  id: string;
  name: string;
  subject: string;
  description: string;
  category: "welcome" | "update" | "promo" | "event" | "reengage" | "notice";
  html_body: string;
};

function emailShell(inner: string): string {
  return `<div style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5ebe9">
          ${inner}
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #eef2f1">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280">
                You're receiving this because you subscribed.
                <a href="{{unsubscribe_url}}" style="color:#0f766e;text-decoration:underline">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

/** Ready-made templates users can pick when creating a new email. */
export const STARTER_TEMPLATES: StarterEmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome email",
    subject: "Welcome, {{name}} — glad you're here",
    description: "Greet new subscribers and set expectations.",
    category: "welcome",
    html_body: emailShell(`
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:28px 28px 24px">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85)">Welcome</p>
              <h1 style="margin:0;font-size:26px;line-height:1.25;color:#ffffff">Hello {{name}},</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2937">
                Thanks for joining. We're happy to have you on the list.
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2937">
                Expect useful updates, tips, and occasional offers — no spam.
              </p>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#1f2937">
                — The team
              </p>
            </td>
          </tr>`),
  },
  {
    id: "weekly-update",
    name: "Weekly update",
    subject: "Hello {{name}} — what's new this week",
    description: "Simple newsletter-style weekly roundup.",
    category: "update",
    html_body: emailShell(`
          <tr>
            <td style="padding:28px 28px 8px">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e">This week</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111827">Hello {{name}},</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151">
                Thanks for being on our list. Here's what's new this week.
              </p>
              <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:15px;line-height:1.7">
                <li>Highlight one — short update</li>
                <li>Highlight two — short update</li>
                <li>Highlight three — short update</li>
              </ul>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#374151">— The team</p>
            </td>
          </tr>`),
  },
  {
    id: "announcement",
    name: "Product announcement",
    subject: "{{name}}, we just launched something new",
    description: "Announce a feature, product, or service.",
    category: "update",
    html_body: emailShell(`
          <tr>
            <td style="padding:28px">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e">Announcement</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111827">Something new for you, {{name}}</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151">
                We've been working on an update we think you'll love. Here's the short version:
              </p>
              <div style="margin:0 0 20px;padding:16px 18px;background:#f0fdfa;border-radius:12px;border:1px solid #ccfbf1">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#134e4a">
                  <strong>What's new:</strong> Describe your launch in one or two sentences.
                </p>
              </div>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151">
                Reply to this email if you have questions — we read every message.
              </p>
              <a href="https://example.com" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">
                Learn more
              </a>
            </td>
          </tr>`),
  },
  {
    id: "promo",
    name: "Special offer",
    subject: "{{name}}, a special offer just for you",
    description: "Promotional deal with a clear call to action.",
    category: "promo",
    html_body: emailShell(`
          <tr>
            <td style="background:#0f766e;padding:28px;text-align:center">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.85)">Limited time</p>
              <h1 style="margin:0;font-size:28px;line-height:1.25;color:#ffffff">Save on your next order</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:center">
              <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#374151">
                Hi {{name}}, as a thank-you for being a subscriber:
              </p>
              <p style="margin:0 0 20px;font-size:36px;font-weight:700;color:#0f766e;letter-spacing:-0.02em">
                20% OFF
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#6b7280">
                Use code <strong style="color:#111827">WELCOME20</strong> at checkout. Offer ends soon.
              </p>
              <a href="https://example.com" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600">
                Shop now
              </a>
            </td>
          </tr>`),
  },
  {
    id: "event",
    name: "Event invitation",
    subject: "{{name}}, you're invited",
    description: "Invite subscribers to a webinar, demo, or event.",
    category: "event",
    html_body: emailShell(`
          <tr>
            <td style="padding:28px">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e">You're invited</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111827">Join us, {{name}}</h1>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#374151">
                We'd love for you to attend our upcoming session. Save your spot below.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
                <tr>
                  <td style="padding:16px 18px">
                    <p style="margin:0 0 6px;font-size:13px;color:#64748b">When</p>
                    <p style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:600">Thursday · 4:00 PM IST</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#64748b">Where</p>
                    <p style="margin:0;font-size:15px;color:#0f172a;font-weight:600">Online · Zoom / Meet link</p>
                  </td>
                </tr>
              </table>
              <a href="https://example.com" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">
                RSVP now
              </a>
            </td>
          </tr>`),
  },
  {
    id: "reengage",
    name: "We miss you",
    subject: "Still thinking of you, {{name}}",
    description: "Win back inactive subscribers with a soft nudge.",
    category: "reengage",
    html_body: emailShell(`
          <tr>
            <td style="padding:28px">
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111827">It's been a while, {{name}}</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151">
                We've missed you in our inbox. Here's a quick catch-up on what you've missed — and an easy way to jump back in.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151">
                If you're still interested, reply or click below. If not, you can unsubscribe anytime — no hard feelings.
              </p>
              <a href="https://example.com" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600">
                Catch up
              </a>
            </td>
          </tr>`),
  },
  {
    id: "plain-notice",
    name: "Simple notice",
    subject: "Quick update for {{name}}",
    description: "Minimal text notice for reminders or alerts.",
    category: "notice",
    html_body: emailShell(`
          <tr>
            <td style="padding:28px">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#111827">Hi {{name}},</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151">
                This is a quick note from our team.
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151">
                Replace this paragraph with your message. Keep it short and clear.
              </p>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#374151">
                Thanks,<br/>The team
              </p>
            </td>
          </tr>`),
  },
];

/** @deprecated Prefer STARTER_TEMPLATES — kept for older clients. */
export const STARTER_TEMPLATE_HTML =
  STARTER_TEMPLATES.find((t) => t.id === "weekly-update")?.html_body ||
  STARTER_TEMPLATES[0].html_body;

export function getStarterTemplate(
  id: string,
): StarterEmailTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id);
}

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
