"use client";

import { SmtpSettingsPanel } from "@/components/email/smtp-settings-panel";

export default function EmailSmtpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SMTP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your mail provider. Campaigns send with your credentials.
        </p>
      </div>
      <SmtpSettingsPanel />
    </div>
  );
}
