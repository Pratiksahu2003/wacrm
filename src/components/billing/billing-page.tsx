"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useSubscription } from "@/hooks/use-subscription";
import type { BillingCycle, VedmintPlan } from "@/lib/vedmint-subscription";
import {
  formatDate,
  formatMoney,
  isPastExpiry,
  isSubscriptionActive,
  planFeatureList,
  planPrice,
} from "@/lib/vedmint-subscription/plan-utils";
import { cn } from "@/lib/utils";

const CUSTOM_CRM_ERP_FEATURES = [
  "Fully custom CRM & ERP modules for your business",
  "WhatsApp Business inbox, templates & broadcast campaigns",
  "Omnichannel conversations (WhatsApp, email, web chat)",
  "Lead capture, scoring, pipelines & deal tracking",
  "Contacts, companies, tags & customer 360° profiles",
  "Billing, inventory, finance & order workflows",
  "Automations, workflows & approval chains",
  "Role-based access, teams & audit logs",
  "Live dashboards, KPIs & exportable reports",
  "Mobile-ready staff apps & field sales tools",
  "Third-party / API integrations (GST, payment, ERP)",
  "Multi-branch / multi-company support",
  "Dedicated implementation, training & handover",
  "Priority support with SLA options",
  "Private cloud or on-prem deployment",
  "Source ownership of custom deliverables",
] as const;

const CUSTOM_SUPPORT_PHONE = "8738871535";
const CUSTOM_SUPPORT_EMAIL = "support@vedmint.com";

export function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canEditSettings, profileLoading } = useAuth();
  const { refresh: refreshEntitlements } = useEntitlements();
  const {
    loading,
    refreshing,
    configured,
    subscription,
    plans,
    invoices,
    error,
    code,
    refresh,
    purchase,
    upgrade,
    downgrade,
    cancel,
    downloadInvoice,
  } = useSubscription();

  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [coupon, setCoupon] = useState("");
  const [buyingPlanId, setBuyingPlanId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const checkoutPolls = useRef(0);

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

  // After Nimbbl → return to /billing?checkout=success, poll until active.
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "cancelled") {
      toast.message("Checkout cancelled");
      router.replace("/billing");
      return;
    }
    if (checkout !== "success") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setConfirmingCheckout(true);
    checkoutPolls.current = 0;

    const poll = async () => {
      checkoutPolls.current += 1;
      try {
        await refresh();
        await refreshEntitlements();
      } catch {
        // keep polling
      }

      if (cancelled) return;

      // Re-check via latest fetch is async; next effect cycle uses new `active`.
      // We also stop after enough attempts.
      if (checkoutPolls.current >= 15) {
        setConfirmingCheckout(false);
        toast.message(
          "Payment received. If your plan is not active yet, tap Refresh in a few seconds.",
        );
        router.replace("/billing");
        return;
      }

      timer = setTimeout(() => {
        void poll();
      }, 2000);
    };

    toast.success("Payment received — confirming your plan…");
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Only react to the checkout query param, not every refresh identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!confirmingCheckout) return;
    if (!active) return;
    setConfirmingCheckout(false);
    toast.success("Your plan is active");
    router.replace("/billing");
    void refreshEntitlements();
  }, [active, confirmingCheckout, refreshEntitlements, router]);

  const currentPlanId =
    Number(subscription?.plan_id) ||
    Number(
      subscription?.plan && typeof subscription.plan === "object"
        ? subscription.plan.id
        : NaN,
    ) ||
    null;

  const currentMonthlyPrice = useMemo(() => {
    const plan =
      subscription?.plan && typeof subscription.plan === "object"
        ? subscription.plan
        : plans.find((p) => p.id === currentPlanId) || null;
    if (!plan) return null;
    const monthly = planPrice(plan, "monthly").amount;
    return monthly;
  }, [subscription, plans, currentPlanId]);

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      const ao = Number(a.sort_order ?? a.id ?? 0);
      const bo = Number(b.sort_order ?? b.id ?? 0);
      return ao - bo;
    });
  }, [plans]);

  const planAction = (
    plan: VedmintPlan,
  ): "current" | "subscribe" | "upgrade" | "downgrade" => {
    if (currentPlanId === plan.id && active) return "current";
    if (!active || currentPlanId == null || currentMonthlyPrice == null) {
      return "subscribe";
    }
    const target = planPrice(plan, "monthly").amount;
    if (target == null) return "subscribe";
    if (target > currentMonthlyPrice) return "upgrade";
    if (target < currentMonthlyPrice) return "downgrade";
    return "subscribe";
  };

  const onSelectPlan = (plan: VedmintPlan) => {
    if (!canEditSettings) {
      toast.error("Only account admins can change the subscription.");
      return;
    }
    const action = planAction(plan);
    if (action === "current") return;

    if (action === "downgrade") {
      if (
        !window.confirm(
          `Downgrade to ${plan.name}? Your plan will change immediately to the lower tier.`,
        )
      ) {
        return;
      }
      startTransition(async () => {
        setBuyingPlanId(plan.id);
        try {
          await downgrade({ planId: plan.id });
          toast.success(`Downgraded to ${plan.name}`);
          await refreshEntitlements();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Downgrade failed");
        } finally {
          setBuyingPlanId(null);
        }
      });
      return;
    }

    startTransition(async () => {
      setBuyingPlanId(plan.id);
      try {
        const checkout =
          action === "upgrade"
            ? await upgrade({
                planId: plan.id,
                billingCycle: cycle,
                couponCode: coupon.trim() || undefined,
              })
            : await purchase({
                planId: plan.id,
                billingCycle: cycle,
                couponCode: coupon.trim() || undefined,
              });
        toast.success(
          action === "upgrade"
            ? "Redirecting to upgrade checkout…"
            : "Redirecting to secure checkout…",
        );
        window.location.href = checkout.paymentUrl;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : action === "upgrade"
              ? "Upgrade failed"
              : "Purchase failed",
        );
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

  const onDownloadInvoice = (invoiceId: string | number) => {
    startTransition(async () => {
      setDownloadingId(String(invoiceId));
      try {
        await downloadInvoice(invoiceId);
        toast.success("Invoice downloaded");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not download invoice",
        );
      } finally {
        setDownloadingId(null);
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

      {confirmingCheckout ? (
        <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-900">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <p>
            Confirming your payment with VedMint… your plan will appear as
            active here in a moment.
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
                {[
                  subscription?.plan_name ||
                    (subscription?.plan &&
                    typeof subscription.plan === "object" &&
                    subscription.plan.name) ||
                    (active
                      ? "Subscribed plan"
                      : confirmingCheckout
                        ? "Confirming payment…"
                        : "No active plan yet"),
                  active || subscription?.billing_cycle
                    ? String(subscription?.billing_cycle || "").toLowerCase() ===
                      "yearly"
                      ? "Yearly"
                      : active
                        ? "Monthly"
                        : null
                    : null,
                  formatDate(
                    (subscription?.current_period_end as string) ||
                      (subscription?.expires_at as string) ||
                      (subscription?.renews_at as string),
                  )
                    ? `renews/ends ${formatDate(
                        (subscription?.current_period_end as string) ||
                          (subscription?.expires_at as string) ||
                          (subscription?.renews_at as string),
                      )}`
                    : typeof subscription?.days_remaining === "number"
                      ? `${subscription.days_remaining} days left`
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
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

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Invoices
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download PDF invoices for your subscription payments.
            </p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No invoices yet. They appear here after a successful payment.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {invoices.map((invoice) => {
              const id = invoice.id;
              const label =
                invoice.invoice_number ||
                invoice.number ||
                `Invoice #${id}`;
              const amount =
                typeof invoice.amount === "number"
                  ? formatMoney(
                      invoice.amount,
                      String(invoice.currency || "INR"),
                    )
                  : null;
              const when =
                formatDate(invoice.issued_at) ||
                formatDate(invoice.paid_at) ||
                formatDate(invoice.created_at);
              const busy = downloadingId === String(id) && pending;

              return (
                <li
                  key={String(id)}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {label}
                      </p>
                      {invoice.status ? (
                        <Badge variant="secondary">{invoice.status}</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[invoice.plan_name, amount, when]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start sm:self-auto"
                    disabled={busy}
                    onClick={() => onDownloadInvoice(id)}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Download PDF
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
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

        {sortedPlans.length === 0 && !configured ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Configure the Subscription API to load self-serve plans. Custom CRM /
            ERP development is always available below.
          </div>
        ) : null}

        {sortedPlans.length === 0 && configured ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            No self-serve plans are assigned yet. Assign plans in VedMint Admin →
            Plans, or contact us for custom CRM / ERP development.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedPlans.map((plan, index) => {
            const price = planPrice(plan, cycle);
            const features = planFeatureList(plan);
            const isCurrent = currentPlanId === plan.id && active;
            const featured =
              Boolean(plan.is_popular || plan.is_featured) || index === 1;
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
                  {(() => {
                    const action = planAction(plan);
                    if (action === "current") {
                      return (
                        <Button disabled className="w-full" variant="secondary">
                          Current plan
                        </Button>
                      );
                    }
                    const label = !canEditSettings
                      ? "Admin only"
                      : action === "upgrade"
                        ? "Upgrade plan"
                        : action === "downgrade"
                          ? "Downgrade"
                          : "Continue to checkout";
                    return (
                      <Button
                        className="w-full"
                        variant={
                          action === "downgrade" ? "outline" : "default"
                        }
                        disabled={!canEditSettings || pending || !configured}
                        onClick={() => onSelectPlan(plan)}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ArrowRight className="size-4" />
                        )}
                        {label}
                      </Button>
                    );
                  })()}
                </div>
              </article>
            );
          })}

          <article className="relative flex flex-col overflow-hidden rounded-2xl border border-primary/30 bg-white p-5 shadow-[0_12px_40px_-24px_rgba(20,184,166,0.45)] ring-1 ring-teal-100">
            <div className="absolute right-4 top-4">
              <Badge className="border-0 bg-teal-50 text-teal-700 hover:bg-teal-50">
                Custom
              </Badge>
            </div>
            <div className="space-y-2 pr-20">
              <div className="inline-flex items-center gap-2 text-teal-700">
                <Wrench className="size-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                  Default option
                </span>
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                Custom CRM / ERP Development
              </h3>
              <p className="text-sm text-slate-600">
                Perfect features, built around your process — not a one-size
                SaaS template.
              </p>
            </div>

            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight text-slate-900">
                Quote
              </span>
              <span className="text-sm text-slate-500">· scoped to you</span>
            </div>

            <ul className="mt-5 flex-1 space-y-2.5">
              {CUSTOM_CRM_ERP_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-slate-800"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid gap-2">
              <Button
                className="w-full border-0 bg-teal-600 text-white hover:bg-teal-500"
                render={<a href={`tel:+91${CUSTOM_SUPPORT_PHONE}`} />}
              >
                <Phone className="size-4" />
                Mobile · {CUSTOM_SUPPORT_PHONE}
              </Button>
              <Button
                variant="outline"
                className="w-full border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900"
                render={<a href={`mailto:${CUSTOM_SUPPORT_EMAIL}`} />}
              >
                <Mail className="size-4" />
                Email · {CUSTOM_SUPPORT_EMAIL}
              </Button>
            </div>
          </article>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Payments are processed securely by Nimbbl on VedMint. After payment,
        you’ll return here and we’ll confirm activation automatically.
      </p>
    </div>
  );
}
