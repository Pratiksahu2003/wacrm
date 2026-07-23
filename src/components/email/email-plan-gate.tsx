"use client";

import Link from "next/link";
import { Lock, Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/use-entitlements";

/** Blocks Email Marketing pages on Starter (Business + Enterprise only). */
export function EmailPlanGate({ children }: { children: React.ReactNode }) {
  const { loading, configured, active, canUse, upgradeMessage, planName } =
    useEntitlements();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
        Checking plan access…
      </div>
    );
  }

  // When subscription API isn't configured, don't hard-block local/dev.
  if (configured && (!active || !canUse("email_marketing"))) {
    return (
      <div className="mx-auto max-w-xl space-y-6 rounded-2xl border border-teal-200 bg-teal-50/70 px-6 py-10 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-teal-600 text-white">
          <Lock className="size-5" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            <Mail className="size-3.5" />
            Email marketing
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Available on Business & Enterprise
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            {upgradeMessage("email_marketing")}
            {planName ? (
              <span className="block mt-2 text-slate-500">
                Current plan: {planName}.
              </span>
            ) : null}
          </p>
        </div>
        <Button
          className="bg-teal-600 text-white hover:bg-teal-500"
          render={<Link href="/billing" />}
        >
          <Sparkles className="size-4" />
          Upgrade plan
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
