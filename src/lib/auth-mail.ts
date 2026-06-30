import nodemailer from "nodemailer";
import {
  COMPANY_NAME,
  OFFICIAL_APP_URL,
  PRODUCT_NAME,
  SUPPORT_EMAIL,
} from "@/lib/brand";

function getSmtpTransporter() {
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "",
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASSWORD || "",
    },
  });
}

function buildAuthLink(redirectTo: string, token: string): string {
  const url = new URL(redirectTo);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildPasswordResetLink(redirectTo: string, token: string): string {
  return buildAuthLink(redirectTo, token);
}

function buildVerificationLink(redirectTo: string, token: string): string {
  return buildAuthLink(redirectTo, token);
}

function buildBrandedEmailHtml(options: {
  heading: string;
  paragraphs: string[];
  actionUrl: string;
  actionLabel: string;
  note?: string;
}): string {
  const { heading, paragraphs, actionUrl, actionLabel, note } = options;
  const host = OFFICIAL_APP_URL.replace("https://", "");

  const bodyHtml = paragraphs.map((p) => `<p style="margin:0 0 16px;color:#334155;line-height:1.6;">${p}</p>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${COMPANY_NAME}</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#0f172a;">${heading}</h1>
    ${bodyHtml}
    <p style="margin:24px 0;">
      <a href="${actionUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">${actionLabel}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.5;">Or copy this link into your browser:</p>
    <p style="margin:0 0 16px;font-size:13px;color:#6366f1;word-break:break-all;">${actionUrl}</p>
    ${note ? `<p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">${note}</p>` : ""}
    <hr style="margin:28px 0;border:none;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
      This message was sent by ${PRODUCT_NAME} (${host}). If you did not request this email, you can ignore it.
      Questions? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#6366f1;">${SUPPORT_EMAIL}</a>.
    </p>
  </div>
</body>
</html>`;
}

/** User-facing hint when Brevo (or similar) rejects the server IP. */
export function smtpErrorMessage(err: unknown): string {
  const response =
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: unknown }).response === "string"
      ? (err as { response: string }).response
      : "";

  if (response.includes("Unauthorized IP")) {
    return "Email could not be sent: the mail provider has not authorized this server's IP address. Ask your admin to whitelist the server IP in Brevo (SMTP → Authorized IPs).";
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "EAUTH"
  ) {
    return "Email could not be sent: SMTP login failed. Check SMTP_USER and SMTP_PASSWORD in the server configuration.";
  }

  return "Could not send email. Please try again later or contact support.";
}

export async function sendVerificationEmail(
  email: string,
  redirectTo: string,
  token: string,
): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error("SMTP is not configured (SMTP_HOST / SMTP_USER missing).");
  }

  const transporter = getSmtpTransporter();
  const verifyLink = buildVerificationLink(redirectTo, token);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "no-reply@vedmint.com",
    to: email,
    subject: `Verify your ${COMPANY_NAME} email address`,
    html: buildBrandedEmailHtml({
      heading: `Verify your email for ${PRODUCT_NAME}`,
      paragraphs: [
        `Thanks for signing up with ${COMPANY_NAME}. Confirm your email address to access your dashboard.`,
      ],
      actionUrl: verifyLink,
      actionLabel: "Verify email address",
      note: "This link is valid for 24 hours.",
    }),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  redirectTo: string,
  token: string,
): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error("SMTP is not configured (SMTP_HOST / SMTP_USER missing).");
  }

  const transporter = getSmtpTransporter();
  const resetLink = buildPasswordResetLink(redirectTo, token);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "no-reply@vedmint.com",
    to: email,
    subject: `Reset your ${COMPANY_NAME} password`,
    html: buildBrandedEmailHtml({
      heading: "Password reset request",
      paragraphs: [
        `We received a request to reset the password for your ${PRODUCT_NAME} account.`,
      ],
      actionUrl: resetLink,
      actionLabel: "Reset password",
      note: "This link is valid for 1 hour. If you did not request a password reset, no action is needed.",
    }),
  });
}

export { buildAuthLink, buildPasswordResetLink, buildVerificationLink };
