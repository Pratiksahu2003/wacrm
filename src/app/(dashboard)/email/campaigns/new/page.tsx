"use client";

import { EmailCampaignWizard } from "@/components/email/email-campaign-wizard";

export default function NewEmailCampaignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a list, compose, then send or schedule.
        </p>
      </div>
      <EmailCampaignWizard />
    </div>
  );
}
