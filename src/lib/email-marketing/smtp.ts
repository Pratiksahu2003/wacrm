import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { query } from "@/lib/mysql";
import { decryptIfEncrypted, encrypt } from "@/lib/whatsapp/encryption";
import type { AccountSmtpSettings } from "./types";

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToPublic(row: Record<string, unknown>): AccountSmtpSettings {
  return {
    account_id: String(row.account_id),
    host: String(row.host),
    port: Number(row.port) || 587,
    secure: Number(row.secure) === 1,
    username: String(row.username),
    from_name: row.from_name ? String(row.from_name) : null,
    from_email: String(row.from_email),
    reply_to: row.reply_to ? String(row.reply_to) : null,
    verified_at: toIso(row.verified_at),
    last_error: row.last_error ? String(row.last_error) : null,
    updated_at: toIso(row.updated_at) || new Date().toISOString(),
    has_password: Boolean(row.password_encrypted),
  };
}

export async function getSmtpSettings(
  accountId: string,
): Promise<AccountSmtpSettings | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT account_id, host, port, secure, username, password_encrypted,
            from_name, from_email, reply_to, verified_at, last_error, updated_at
     FROM account_smtp_settings
     WHERE account_id = ?
     LIMIT 1`,
    [accountId],
  );
  if (!rows[0]) return null;
  return rowToPublic(rows[0]);
}

async function getSmtpPassword(accountId: string): Promise<string | null> {
  const rows = await query<{ password_encrypted: string }>(
    `SELECT password_encrypted FROM account_smtp_settings WHERE account_id = ? LIMIT 1`,
    [accountId],
  );
  const enc = rows[0]?.password_encrypted;
  if (!enc) return null;
  return decryptIfEncrypted(enc).plaintext;
}

export function createAccountTransporter(input: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}) {
  const options: SMTPTransport.Options = {
    host: input.host,
    port: input.port,
    secure: input.secure || input.port === 465,
    auth: {
      user: input.username,
      pass: input.password,
    },
  };
  return nodemailer.createTransport(options);
}

export async function upsertSmtpSettings(
  accountId: string,
  input: {
    host: string;
    port: number;
    secure?: boolean;
    username: string;
    password?: string;
    from_name?: string | null;
    from_email: string;
    reply_to?: string | null;
  },
): Promise<AccountSmtpSettings> {
  const host = input.host.trim();
  const username = input.username.trim();
  const fromEmail = input.from_email.trim();
  const port = Math.min(Math.max(Math.floor(Number(input.port) || 587), 1), 65535);
  const secure = Boolean(input.secure) || port === 465;

  if (!host || !username || !fromEmail) {
    throw new Error("host, username, and from_email are required");
  }

  const existing = await getSmtpPassword(accountId);
  let passwordEncrypted: string;
  if (input.password && input.password.trim()) {
    passwordEncrypted = encrypt(input.password.trim());
  } else if (existing) {
    const rows = await query<{ password_encrypted: string }>(
      `SELECT password_encrypted FROM account_smtp_settings WHERE account_id = ? LIMIT 1`,
      [accountId],
    );
    passwordEncrypted = rows[0]?.password_encrypted || "";
  } else {
    throw new Error("password is required when configuring SMTP for the first time");
  }

  if (!passwordEncrypted) {
    throw new Error("password is required when configuring SMTP for the first time");
  }

  await query(
    `INSERT INTO account_smtp_settings
       (account_id, host, port, secure, username, password_encrypted,
        from_name, from_email, reply_to, verified_at, last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       host = VALUES(host),
       port = VALUES(port),
       secure = VALUES(secure),
       username = VALUES(username),
       password_encrypted = VALUES(password_encrypted),
       from_name = VALUES(from_name),
       from_email = VALUES(from_email),
       reply_to = VALUES(reply_to),
       verified_at = NULL,
       last_error = NULL,
       updated_at = UTC_TIMESTAMP()`,
    [
      accountId,
      host,
      port,
      secure ? 1 : 0,
      username,
      passwordEncrypted,
      input.from_name?.trim() || null,
      fromEmail,
      input.reply_to?.trim() || null,
    ],
  );

  const settings = await getSmtpSettings(accountId);
  if (!settings) throw new Error("Failed to load SMTP settings after save");
  return settings;
}

export async function deleteSmtpSettings(accountId: string): Promise<void> {
  await query(`DELETE FROM account_smtp_settings WHERE account_id = ?`, [
    accountId,
  ]);
}

export async function verifySmtpConnection(accountId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const settings = await getSmtpSettings(accountId);
  const password = await getSmtpPassword(accountId);
  if (!settings || !password) {
    return { ok: false, error: "SMTP is not configured" };
  }

  const transporter = createAccountTransporter({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    password,
  });

  try {
    await transporter.verify();
    await query(
      `UPDATE account_smtp_settings
       SET verified_at = UTC_TIMESTAMP(), last_error = NULL, updated_at = UTC_TIMESTAMP()
       WHERE account_id = ?`,
      [accountId],
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP verification failed";
    await query(
      `UPDATE account_smtp_settings
       SET verified_at = NULL, last_error = ?, updated_at = UTC_TIMESTAMP()
       WHERE account_id = ?`,
      [message.slice(0, 1000), accountId],
    );
    return { ok: false, error: message };
  }
}

export async function sendWithAccountSmtp(input: {
  accountId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const settings = await getSmtpSettings(input.accountId);
  const password = await getSmtpPassword(input.accountId);
  if (!settings || !password) {
    throw new Error("SMTP is not configured for this account");
  }

  const transporter = createAccountTransporter({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    password,
  });

  const from = settings.from_name
    ? `"${settings.from_name.replace(/"/g, "")}" <${settings.from_email}>`
    : settings.from_email;

  await transporter.sendMail({
    from,
    to: input.to,
    replyTo: settings.reply_to || undefined,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

export async function sendSmtpTestEmail(
  accountId: string,
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendWithAccountSmtp({
      accountId,
      to,
      subject: "VedMint Email Marketing — SMTP test",
      html: `<p>Your SMTP connection is working.</p>
<p style="color:#6b7280;font-size:13px">Sent from VedMint Email Marketing.</p>`,
      text: "Your SMTP connection is working. Sent from VedMint Email Marketing.",
    });
    await query(
      `UPDATE account_smtp_settings
       SET verified_at = UTC_TIMESTAMP(), last_error = NULL, updated_at = UTC_TIMESTAMP()
       WHERE account_id = ?`,
      [accountId],
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test email failed";
    await query(
      `UPDATE account_smtp_settings
       SET last_error = ?, updated_at = UTC_TIMESTAMP()
       WHERE account_id = ?`,
      [message.slice(0, 1000), accountId],
    );
    return { ok: false, error: message };
  }
}
