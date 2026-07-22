import {
  getBroadcastInternalSecret,
  getInternalAppOrigin,
} from "@/lib/broadcasts/trigger";

export function getEmailCampaignInternalSecret(): string | undefined {
  return getBroadcastInternalSecret();
}

export function triggerEmailCampaignProcessingHttp(campaignId: string): void {
  const secret = getEmailCampaignInternalSecret();
  if (!secret) {
    console.error(
      "[email-campaign] cannot auto-start processor — set ENCRYPTION_KEY or BROADCAST_CRON_SECRET",
    );
    return;
  }

  const url = `${getInternalAppOrigin()}/api/email/campaigns/process`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": secret,
    },
    body: JSON.stringify({ campaign_id: campaignId }),
  }).catch((err) => {
    console.error(
      `[email-campaign] auto process request failed for ${campaignId}:`,
      err,
    );
  });
}
