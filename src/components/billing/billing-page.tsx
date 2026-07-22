"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import type { BillingCycle, VedmintPlan } from "@/lib/vedmint-subscription";
import {
  formatDate,
  isPastExpiry,
  isSubscriptionActive,
  planFeatureList,
  planPrice,
} from "@/lib/vedmint-subscription/plan-utils";
import { cn } from "@/lib/utils";

export function BillingPage() {
  const { canEditSettings, profileLoading } = useAuth();
  const {
    loading,
    refreshing,
    configured,
    subscription,
    plans,
    error,
    code,
    refresh,
    purchase,
    cancel,
  } = useSubscription();

  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [coupon, setCoupon] = useState("");
  const [buyingPlanId, setBuyingPlanId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = isSubscriptionActive(
    subscription?.status as string | undefined,
    typeof subscription?.active === "boolean"
      ? (subscription.active as boolean)
      : undefined,
    (subscription?.expires_at as string) ||
      (subscription?.current_period_end as string) ||
      (subscription?.renews_at as string) ||
      null,
  );

  const currentPlanId =
    Number(subscription?.plan_id) ||
    Number(
      subscription?.plan && typeof subscription.plan === "object"
        ? subscription.plan.id
        : NaN,
    ) ||
    null;

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      const ao = Number(a.sort_order ?? a.id ?? 0);
      const bo = Number(b.sort_order ?? b.id ?? 0);
      return ao - bo;
    });
  }, [plans]);

  const onPurchase = (plan: VedmintPlan) => {
    if (!canEditSettings) {
      toast.error("Only account admins can change the subscription.");
      return;
    }
    startTransition(async () => {
      setBuyingPlanId(plan.id);
      try {
        const { paymentUrl } = await purchase({
          planId: plan.id,
          billingCycle: cycle,
          couponCode: coupon.trim() || undefined,
        });
        toast.success("Redirecting to secure checkout…");
        window.location.href = paymentUrl;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Purchase failed");
        setBuyingPlanId(null);
      }
    });
  };

  const onCancel = () => {
    if (!canEditSettings) {
      toast.error("Only account admins can cancel the subscription.");
      return;
    }
    if (
      !window.confirm(
        "Cancel your subscription? You’ll keep access until the current period ends (if applicable).",
      )
    ) {
      return;
    }
    startTransition(async () => {
      setCancelling(true);
      try {
        await cancel();
        toast.success("Subscription cancelled");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cancel failed");
      } finally {
        setCancelling(false);
      }
    });
  };

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading billing…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50 via-white to-teal-50/80 px-6 py-8 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-teal-400/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-10 size-56 rounded-full bg-slate-400/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
              <Sparkles className="size-3.5" />
              VedMint Billing
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Choose the plan that fits your team
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Secure checkout via Nimbbl. Your subscription unlocks CRM capacity
              and premium features for this workspace.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="self-start sm:self-auto"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </header>

      {!configured || code === "VEDMINT_NOT_CONFIGURED" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-medium">Subscription API not configured</p>
          <p className="mt-1 text-amber-800/90">
            Set <code className="rounded bg-amber-100 px-1">VEDMINT_APP_KEY</code>{" "}
            and{" "}
            <code className="rounded bg-amber-100 px-1">VEDMINT_APP_SECRET</code>{" "}
            in the server environment, whitelist origin{" "}
            <code className="rounded bg-amber-100 px-1">https://wa.vedmint.com</code>
            , and assign plans in VedMint Admin.
          </p>
        </div>
      ) : null}

      {error && code !== "VEDMINT_NOT_CONFIGURED" ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Current subscription
                </h2>
                <Badge variant={active ? "default" : "secondary"}>
                  {active
                    ? "Active"
                    : isPastExpiry(
                          (subscription?.expires_at as string) ||
                            (subscription?.current_period_end as string),
                        )
                      ? "Expired"
                      : subscription?.status || "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription?.plan_name ||
                  (subscription?.plan &&
                  typeof subscription.plan === "object" &&
                  subscription.plan.name) ||
                  (active ? "Subscribed plan" : "No active plan yet")}
                {formatDate(
                  (subscription?.current_period_end as string) ||
                    (subscription?.expires_at as string) ||
                    (subscription?.renews_at as string),
                )
                  ? ` · renews/ends ${formatDate(
                      (subscription?.current_period_end as string) ||
                        (subscription?.expires_at as string) ||
                        (subscription?.renews_at as string),
                    )}`
                  : ""}
              </p>
            </div>
          </div>
          {active && canEditSettings ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={cancelling || pending}
              className="text-destructive hover:text-destructive"
            >
              {cancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              Cancel plan
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Plans</h2>
            <p className="text-sm text-muted-foreground">
              Pick a cycle, then continue to Nimbbl checkout.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-border bg-muted/40 p-1">
            {(["monthly", "yearly"] as BillingCycle[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  cycle === c
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:max-w-sm">
          <label
            htmlFor="coupon"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Coupon (optional)
          </label>
          <input
            id="coupon"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder="WELCOME20"
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>

        {sortedPlans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            {configured
              ? "No plans are assigned to this application yet. Assign plans in VedMint Admin → Plans."
              : "Configure the Subscription API to load plans."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedPlans.map((plan, index) => {
              const price = planPrice(plan, cycle);
              const features = planFeatureList(plan);
              const isCurrent = currentPlanId === plan.id && active;
              const featured = Boolean(plan.is_popular || plan.is_featured) || index === 1;
              const busy = buyingPlanId === plan.id && pending;

              return (
                <article
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col overflow-hidden rounded-2xl border bg-card p-5 transition-shadow",
                    featured
                      ? "border-primary/40 shadow-[0_12px_40px_-24px_rgba(20,184,166,0.55)]"
                      : "border-border hover:shadow-md",
                    isCurrent && "ring-2 ring-primary/30",
                  )}
                >
                  {featured ? (
                    <div className="absolute right-4 top-4">
                      <Badge>Popular</Badge>
                    </div>
                  ) : null}
                  <div className="space-y-1 pr-16">
                    <h3 className="text-lg font-semibold text-foreground">
                      {plan.name}
                    </h3>
                    {plan.description ? (
                      <p className="text-sm text-muted-foreground">
                        {String(plan.description)}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-foreground">
                      {price.label}
                    </span>
                    {price.amount != null ? (
                      <span className="text-sm text-muted-foreground">
                        /{cycle === "monthly" ? "mo" : "yr"}
                      </span>
                    ) : null}
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {features.length > 0 ? (
                      features.slice(0, 8).map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-sm text-foreground/90"
                        >
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))
                    ) : (
                      <li className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                        Full plan entitlements applied after purchase
                      </li>
                    )}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <Button disabled className="w-full" variant="secondary">
                        Current plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={!canEditSettings || pending || !configured}
                        onClick={() => onPurchase(plan)}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ArrowRight className="size-4" />
                        )}
                        {canEditSettings ? "Continue to checkout" : "Admin only"}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Payments are processed securely by Nimbbl on VedMint. After payment,
        you’ll return here and we’ll confirm activation automatically.
      </p>
    </div>
  );
}
