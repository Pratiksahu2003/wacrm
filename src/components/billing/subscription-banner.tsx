"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Clock3, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/use-entitlements";
import { formatDate } from "@/lib/vedmint-subscription/plan-utils";

/** Global subscription banner: expired lock + expiring-soon warning. */
export function SubscriptionBanner() {
  const pathname = usePathname();
  const {
    loading,
    configured,
    active,
    expired,
    expiringSoon,
    daysRemaining,
    expiresAt,
    planName,
    status,
  } = useEntitlements();

  if (loading || !configured) return null;
  if (pathname.startsWith("/billing")) return null;

  if (expired || !active) {
    return (
      <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 to-teal-50 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-amber-950">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <p>
              <span className="font-medium">
                {expired ? "Subscription expired" : "Subscription inactive"}
              </span>
              {status && !expired ? ` (${status})` : ""}.
              {planName ? ` Plan: ${planName}.` : ""}
              {expiresAt ? ` Ended ${formatDate(expiresAt)}.` : ""} Premium
              actions are locked until you renew.
            </p>
          </div>
          <Button
            size="sm"
            className="self-start sm:self-auto"
            render={<Link href="/billing" />}
          >
            Renew plan
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (expiringSoon && expiresAt) {
    return (
      <div className="border-b border-teal-200 bg-gradient-to-r from-teal-50 to-slate-50 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-slate-800">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-teal-700" />
            <p>
              <span className="font-medium">Plan ending soon</span>
              {planName ? ` — ${planName}` : ""}.
              {typeof daysRemaining === "number"
                ? daysRemaining === 0
                  ? " Expires today"
                  : ` ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`
                : ""}
              {expiresAt ? ` (${formatDate(expiresAt)})` : ""}. Renew to avoid
              interruption.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="self-start sm:self-auto"
            render={<Link href="/billing" />}
          >
            Renew now
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
