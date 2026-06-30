import nodemailer from "nodemailer";

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
    subject: "Verify your VedMint CRM email address",
    html: `<p>Thanks for signing up. Click <a href="${verifyLink}">here</a> to verify your email address and access your dashboard.</p><p>This link is valid for 24 hours.</p><p>If you did not create an account, you can ignore this email.</p>`,
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
    subject: "Reset your VedMint CRM password",
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password. The link is valid for 1 hour.</p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

export { buildAuthLink, buildPasswordResetLink, buildVerificationLink };
