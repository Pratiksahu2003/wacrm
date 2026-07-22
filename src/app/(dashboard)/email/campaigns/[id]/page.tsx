"use client";

import { use } from "react";

import { EmailCampaignDetail } from "@/components/email/email-campaign-detail";

export default function EmailCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivery stats from your SMTP provider.
        </p>
      </div>
      <EmailCampaignDetail campaignId={id} />
    </div>
  );
}
