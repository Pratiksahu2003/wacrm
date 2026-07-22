"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailCampaign } from "@/lib/email-marketing/types";

export function EmailCampaignsPanel() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/campaigns", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load campaigns");
      setCampaigns(json.data?.campaigns ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load campaigns",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const hasSending = campaigns.some(
      (c) => c.status === "sending" || c.status === "scheduled",
    );
    if (!hasSending) return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [campaigns, refresh]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading campaigns…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/email/campaigns/new"
          className={cn(buttonVariants(), "inline-flex gap-1.5")}
        >
          <Plus className="size-4" />
          New campaign
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaigns yet. Create a list and send your first email.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/email/campaigns/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {c.sent_count} sent · {c.failed_count} failed ·{" "}
                    {c.skipped_count} skipped · {c.total_count} total
                  </p>
                </div>
                <Badge variant="secondary">{c.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
