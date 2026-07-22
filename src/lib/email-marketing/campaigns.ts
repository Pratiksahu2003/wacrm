import { randomUUID } from "crypto";

import { query } from "@/lib/mysql";
import {
  applyMergeTags,
  ensureUnsubscribeFooter,
  stripHtmlToText,
} from "./merge";
import { buildUnsubscribeUrl } from "./site-url";
import { sendWithAccountSmtp, getSmtpSettings } from "./smtp";
import { getEmailList } from "./lists";
import { getTemplate } from "./templates";
import { triggerEmailCampaignProcessingHttp } from "./trigger";
import type { CampaignStatus, EmailCampaign } from "./types";

const SEND_BATCH_SIZE = 10;
const SEND_BATCH_DELAY_MS = 500;
const activeCampaigns = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapCampaign(row: Record<string, unknown>): EmailCampaign {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    list_id: String(row.list_id),
    template_id: row.template_id ? String(row.template_id) : null,
    name: String(row.name),
    subject: String(row.subject),
    html_body: String(row.html_body),
    text_body: row.text_body ? String(row.text_body) : null,
    status: String(row.status) as CampaignStatus,
    scheduled_at: toIso(row.scheduled_at),
    started_at: toIso(row.started_at),
    completed_at: toIso(row.completed_at),
    total_count: Number(row.total_count ?? 0),
    sent_count: Number(row.sent_count ?? 0),
    failed_count: Number(row.failed_count ?? 0),
    skipped_count: Number(row.skipped_count ?? 0),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: toIso(row.created_at) || new Date().toISOString(),
    updated_at: toIso(row.updated_at) || new Date().toISOString(),
  };
}

export async function listCampaigns(
  accountId: string,
): Promise<EmailCampaign[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_campaigns WHERE account_id = ? ORDER BY created_at DESC`,
    [accountId],
  );
  return rows.map(mapCampaign);
}

export async function getCampaign(
  accountId: string,
  campaignId: string,
): Promise<EmailCampaign | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM email_campaigns WHERE id = ? AND account_id = ? LIMIT 1`,
    [campaignId, accountId],
  );
  return rows[0] ? mapCampaign(rows[0]) : null;
}

export async function createCampaign(
  accountId: string,
  userId: string,
  input: {
    name: string;
    list_id: string;
    template_id?: string | null;
    subject?: string;
    html_body?: string;
    text_body?: string | null;
  },
): Promise<EmailCampaign> {
  const list = await getEmailList(accountId, input.list_id);
  if (!list) throw new Error("List not found");

  let subject = input.subject?.trim() || "";
  let html = input.html_body?.trim() || "";
  let text = input.text_body?.trim() || null;
  let templateId: string | null = input.template_id || null;

  if (templateId) {
    const tpl = await getTemplate(accountId, templateId);
    if (!tpl) throw new Error("Template not found");
    subject = subject || tpl.subject;
    html = html || tpl.html_body;
    text = text ?? tpl.text_body;
  }

  if (!subject || !html) {
    throw new Error("subject and html_body are required (or provide template_id)");
  }

  const name = input.name.trim() || subject;
  const id = randomUUID();
  await query(
    `INSERT INTO email_campaigns
       (id, account_id, list_id, template_id, name, subject, html_body, text_body,
        status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [id, accountId, list.id, templateId, name, subject, html, text, userId],
  );
  const campaign = await getCampaign(accountId, id);
  if (!campaign) throw new Error("Failed to create campaign");
  return campaign;
}

export async function updateCampaignDraft(
  accountId: string,
  campaignId: string,
  input: {
    name?: string;
    subject?: string;
    html_body?: string;
    text_body?: string | null;
  },
): Promise<EmailCampaign> {
  const current = await getCampaign(accountId, campaignId);
  if (!current) throw new Error("Campaign not found");
  if (current.status !== "draft" && current.status !== "scheduled") {
    throw new Error("Only draft or scheduled campaigns can be edited");
  }

  await query(
    `UPDATE email_campaigns
     SET name = ?, subject = ?, html_body = ?, text_body = ?, updated_at = UTC_TIMESTAMP()
     WHERE id = ? AND account_id = ?`,
    [
      input.name?.trim() || current.name,
      input.subject?.trim() || current.subject,
      input.html_body?.trim() || current.html_body,
      input.text_body === undefined
        ? current.text_body
        : input.text_body?.trim() || null,
      campaignId,
      accountId,
    ],
  );
  const updated = await getCampaign(accountId, campaignId);
  if (!updated) throw new Error("Campaign not found");
  return updated;
}

async function enqueueRecipients(
  accountId: string,
  campaignId: string,
  listId: string,
): Promise<number> {
  const subscribers = await query<Record<string, unknown>>(
    `SELECT id, email FROM email_subscribers
     WHERE account_id = ? AND list_id = ? AND status = 'subscribed'`,
    [accountId, listId],
  );

  const INSERT_BATCH = 200;
  for (let i = 0; i < subscribers.length; i += INSERT_BATCH) {
    const slice = subscribers.slice(i, i + INSERT_BATCH);
    if (slice.length === 0) continue;
    const values: unknown[] = [];
    const placeholders: string[] = [];
    for (const sub of slice) {
      placeholders.push("(?, ?, ?, ?, 'pending')");
      values.push(randomUUID(), campaignId, String(sub.id), String(sub.email));
    }
    await query(
      `INSERT INTO email_campaign_recipients
         (id, campaign_id, subscriber_id, email, status)
       VALUES ${placeholders.join(",")}`,
      values,
    );
  }
  return subscribers.length;
}

export async function startCampaign(
  accountId: string,
  campaignId: string,
  opts?: { scheduled_at?: string | null },
): Promise<EmailCampaign> {
  const smtp = await getSmtpSettings(accountId);
  if (!smtp) throw new Error("Configure SMTP before sending a campaign");

  const campaign = await getCampaign(accountId, campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    throw new Error(`Cannot start campaign in status ${campaign.status}`);
  }

  // Clear previous recipients if re-queuing a draft that somehow has rows
  await query(`DELETE FROM email_campaign_recipients WHERE campaign_id = ?`, [
    campaignId,
  ]);

  const total = await enqueueRecipients(
    accountId,
    campaignId,
    campaign.list_id,
  );
  if (total === 0) {
    throw new Error("No subscribed recipients on this list");
  }

  const scheduledAt = opts?.scheduled_at || null;
  if (scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 30_000) {
    await query(
      `UPDATE email_campaigns
       SET status = 'scheduled',
           scheduled_at = ?,
           total_count = ?,
           sent_count = 0,
           failed_count = 0,
           skipped_count = 0,
           started_at = NULL,
           completed_at = NULL,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND account_id = ?`,
      [new Date(scheduledAt), total, campaignId, accountId],
    );
  } else {
    await query(
      `UPDATE email_campaigns
       SET status = 'sending',
           scheduled_at = NULL,
           total_count = ?,
           sent_count = 0,
           failed_count = 0,
           skipped_count = 0,
           started_at = UTC_TIMESTAMP(),
           completed_at = NULL,
           updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND account_id = ?`,
      [total, campaignId, accountId],
    );
    triggerEmailCampaignProcessingHttp(campaignId);
  }

  const updated = await getCampaign(accountId, campaignId);
  if (!updated) throw new Error("Campaign not found");
  return updated;
}

export async function processEmailCampaign(campaignId: string): Promise<void> {
  if (activeCampaigns.has(campaignId)) return;
  activeCampaigns.add(campaignId);

  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM email_campaigns WHERE id = ? LIMIT 1`,
      [campaignId],
    );
    const campaignRow = rows[0];
    if (!campaignRow) return;
    const campaign = mapCampaign(campaignRow);
    if (campaign.status !== "sending") return;

    while (true) {
      const pending = await query<Record<string, unknown>>(
        `SELECT r.id, r.email, r.subscriber_id, s.name AS subscriber_name,
                s.unsubscribe_token, s.status AS subscriber_status
         FROM email_campaign_recipients r
         JOIN email_subscribers s ON s.id = r.subscriber_id
         WHERE r.campaign_id = ? AND r.status = 'pending'
         ORDER BY r.created_at ASC
         LIMIT ${SEND_BATCH_SIZE}`,
        [campaignId],
      );

      if (pending.length === 0) break;

      for (const row of pending) {
        const recipientId = String(row.id);
        const email = String(row.email);
        const subStatus = String(row.subscriber_status);

        if (subStatus !== "subscribed") {
          await query(
            `UPDATE email_campaign_recipients
             SET status = 'skipped', error = 'unsubscribed', sent_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [recipientId],
          );
          await query(
            `UPDATE email_campaigns
             SET skipped_count = skipped_count + 1, updated_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [campaignId],
          );
          continue;
        }

        const unsubUrl = buildUnsubscribeUrl(String(row.unsubscribe_token));
        const vars = {
          name: row.subscriber_name
            ? String(row.subscriber_name)
            : email.split("@")[0] || "there",
          email,
          unsubscribe_url: unsubUrl,
        };
        const subject = applyMergeTags(campaign.subject, vars);
        let html = applyMergeTags(campaign.html_body, vars);
        html = ensureUnsubscribeFooter(html, unsubUrl);
        const text =
          campaign.text_body != null
            ? applyMergeTags(campaign.text_body, vars)
            : stripHtmlToText(html);

        try {
          await sendWithAccountSmtp({
            accountId: campaign.account_id,
            to: email,
            subject,
            html,
            text,
          });
          await query(
            `UPDATE email_campaign_recipients
             SET status = 'sent', error = NULL, sent_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [recipientId],
          );
          await query(
            `UPDATE email_campaigns
             SET sent_count = sent_count + 1, updated_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [campaignId],
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Send failed";
          await query(
            `UPDATE email_campaign_recipients
             SET status = 'failed', error = ?, sent_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [message.slice(0, 1000), recipientId],
          );
          await query(
            `UPDATE email_campaigns
             SET failed_count = failed_count + 1, updated_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [campaignId],
          );
        }
      }

      await sleep(SEND_BATCH_DELAY_MS);
    }

    await query(
      `UPDATE email_campaigns
       SET status = 'sent', completed_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND status = 'sending'`,
      [campaignId],
    );
  } finally {
    activeCampaigns.delete(campaignId);
  }
}

/** Resume sending campaigns and start due scheduled ones. */
export async function sweepEmailCampaigns(): Promise<{
  resumed: number;
  started: number;
}> {
  let resumed = 0;
  let started = 0;

  const sending = await query<{ id: string }>(
    `SELECT id FROM email_campaigns WHERE status = 'sending' ORDER BY started_at ASC LIMIT 20`,
  );
  for (const row of sending) {
    triggerEmailCampaignProcessingHttp(row.id);
    resumed++;
  }

  const due = await query<{ id: string; account_id: string }>(
    `SELECT id, account_id FROM email_campaigns
     WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= UTC_TIMESTAMP()
     ORDER BY scheduled_at ASC
     LIMIT 20`,
  );
  for (const row of due) {
    await query(
      `UPDATE email_campaigns
       SET status = 'sending', started_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND status = 'scheduled'`,
      [row.id],
    );
    triggerEmailCampaignProcessingHttp(row.id);
    started++;
  }

  return { resumed, started };
}

export async function listCampaignRecipients(
  accountId: string,
  campaignId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    email: string;
    status: string;
    error: string | null;
    sent_at: string | null;
  }>
> {
  const campaign = await getCampaign(accountId, campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 200);
  const rows = await query<Record<string, unknown>>(
    `SELECT id, email, status, error, sent_at
     FROM email_campaign_recipients
     WHERE campaign_id = ?
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
    [campaignId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    status: String(row.status),
    error: row.error ? String(row.error) : null,
    sent_at: toIso(row.sent_at),
  }));
}
