"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { EmailCampaign } from "@/lib/email-marketing/types";

type Recipient = {
  id: string;
  email: string;
  status: string;
  error: string | null;
  sent_at: string | null;
};

export function EmailCampaignDetail({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/email/campaigns/${campaignId}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load campaign");
      setCampaign(json.data?.campaign ?? null);
      setRecipients(json.data?.recipients ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load campaign",
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (campaign?.status !== "sending" && campaign?.status !== "scheduled") {
      return;
    }
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [campaign?.status, refresh]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading campaign…
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">Campaign not found.</p>;
  }

  const pct = campaign.total_count
    ? Math.round(
        ((campaign.sent_count + campaign.failed_count + campaign.skipped_count) /
          campaign.total_count) *
          100,
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{campaign.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {campaign.subject}
            </p>
          </div>
          <Badge variant="secondary">{campaign.status}</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Metric label="Total" value={campaign.total_count} />
          <Metric label="Sent" value={campaign.sent_count} />
          <Metric label="Failed" value={campaign.failed_count} />
          <Metric label="Skipped" value={campaign.skipped_count} />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold">Recent recipients</h3>
        {recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipients yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recipients.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span className="truncate">{r.email}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.status}</Badge>
                  {r.error ? (
                    <span className="max-w-[220px] truncate text-xs text-destructive">
                      {r.error}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
