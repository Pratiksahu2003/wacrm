"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Mail,
  Phone,
  Sparkles,
  Wrench,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { vm } from "@/components/marketing/marketing-theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CUSTOM_PLAN,
  PRICING_FAQ,
  PUBLIC_SUBSCRIPTION_PLANS,
} from "@/lib/marketing/public-plans";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Cycle = "monthly" | "yearly";

export function PricingPageContent() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <MarketingShell theme="light">
      <section className="relative overflow-hidden border-b border-slate-200">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-teal-400/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-8 size-64 rounded-full bg-slate-400/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <Badge variant="secondary" className={cn("mb-4", vm.badge)}>
            <Sparkles className="mr-1 size-3.5" />
            Subscription plans
          </Badge>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Simple plans for WhatsApp Business CRM
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            Choose a {PRODUCT_NAME} plan for shared inbox, contacts, pipelines,
            broadcasts, and automations. Sign up to unlock live checkout and
            workspace entitlements.
          </p>

          <div className="mt-8 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  cycle === c
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {c === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PUBLIC_SUBSCRIPTION_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-2xl border bg-white p-5 transition-shadow",
                plan.featured
                  ? "border-teal-300 shadow-[0_12px_40px_-24px_rgba(20,184,166,0.55)]"
                  : "border-slate-200 hover:shadow-md",
              )}
            >
              {plan.featured ? (
                <div className="absolute right-4 top-4">
                  <Badge className="border-0 bg-teal-50 text-teal-700 hover:bg-teal-50">
                    Popular
                  </Badge>
                </div>
              ) : null}
              <div className="space-y-1 pr-16">
                <h2 className="text-lg font-semibold text-slate-900">
                  {plan.name}
                </h2>
                <p className="text-sm text-slate-600">{plan.description}</p>
              </div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-slate-900">
                  {cycle === "monthly" ? plan.monthlyLabel : plan.yearlyLabel}
                </span>
                <span className="text-sm text-slate-500">
                  /{cycle === "monthly" ? "mo" : "yr"}
                </span>
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-slate-800"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-teal-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button
                  className={cn("w-full", vm.btnPrimary)}
                  render={<Link href={plan.href} />}
                >
                  {plan.cta}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </article>
          ))}

          <article className="relative flex flex-col overflow-hidden rounded-2xl border border-teal-200 bg-white p-5 ring-1 ring-teal-100">
            <div className="absolute right-4 top-4">
              <Badge className="border-0 bg-teal-50 text-teal-700 hover:bg-teal-50">
                Custom
              </Badge>
            </div>
            <div className="space-y-2 pr-20">
              <div className="inline-flex items-center gap-2 text-teal-700">
                <Wrench className="size-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">
                  Tailored build
                </span>
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {CUSTOM_PLAN.name}
              </h2>
              <p className="text-sm text-slate-600">{CUSTOM_PLAN.description}</p>
            </div>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight text-slate-900">
                Quote
              </span>
              <span className="text-sm text-slate-500">· scoped to you</span>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5">
              {CUSTOM_PLAN.features.map((f) => (
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
                render={<a href={`tel:+91${CUSTOM_PLAN.ctaPhone}`} />}
              >
                <Phone className="size-4" />
                Mobile · {CUSTOM_PLAN.ctaPhone}
              </Button>
              <Button
                variant="outline"
                className={cn("w-full", vm.btnOutline)}
                render={<a href={`mailto:${CUSTOM_PLAN.ctaEmail}`} />}
              >
                <Mail className="size-4" />
                Email · {CUSTOM_PLAN.ctaEmail}
              </Button>
            </div>
          </article>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Starting prices are indicative. After signup, Billing shows live
          VedMint plan amounts, coupons, and entitlements for your workspace.
        </p>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Pricing FAQ
          </h2>
          <dl className="mt-8 space-y-6">
            {PRICING_FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-base font-semibold text-slate-900">
                  {item.q}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              className={vm.btnPrimary}
              render={<Link href="/signup" />}
            >
              Create account
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className={vm.btnOutline}
              render={<Link href="/discover" />}
            >
              Explore features
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
