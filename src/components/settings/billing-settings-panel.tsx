"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import {
  formatDate,
  isSubscriptionActive,
} from "@/lib/vedmint-subscription/plan-utils";

export function BillingSettingsPanel() {
  const { loading, configured, subscription, error, code } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading billing…
      </div>
    );
  }

  const active = isSubscriptionActive(
    subscription?.status as string | undefined,
    typeof subscription?.active === "boolean"
      ? (subscription.active as boolean)
      : undefined,
  );

  const planName =
    subscription?.plan_name ||
    (subscription?.plan &&
    typeof subscription.plan === "object" &&
    subscription.plan.name) ||
    null;

  const ends = formatDate(
    (subscription?.current_period_end as string) ||
      (subscription?.expires_at as string) ||
      (subscription?.renews_at as string),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">Subscription</h2>
                <Badge variant={active ? "default" : "secondary"}>
                  {active ? "Active" : subscription?.status || "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {!configured || code === "VEDMINT_NOT_CONFIGURED"
                  ? "Connect VedMint Subscription API keys to enable plans and checkout."
                  : planName
                    ? `${planName}${ends ? ` · ${ends}` : ""}`
                    : "No active plan. Open Billing to choose one."}
              </p>
              {error && code !== "VEDMINT_NOT_CONFIGURED" ? (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              ) : null}
            </div>
          </div>
          <Button render={<Link href="/billing" />}>
            Manage billing
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
