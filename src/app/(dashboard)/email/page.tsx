"use client";

import { EmailOverview } from "@/components/email/email-overview";

export default function EmailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring your SMTP, grow email lists, and send campaigns from VedMint.
        </p>
      </div>
      <EmailOverview />
    </div>
  );
}
