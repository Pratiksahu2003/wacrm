/** Public marketing plans shown on /pricing (checkout happens after signup). */

import type { VedmintPlan } from "@/lib/vedmint-subscription/types";
import { planFeatureList, planPrice } from "@/lib/vedmint-subscription/plan-utils";
import {
  isBusinessPlan,
  isEnterprisePlan,
  isStarterPlan,
} from "@/lib/vedmint-subscription/entitlements";

export type PublicPlan = {
  id: string;
  name: string;
  description: string;
  /** Numeric display amount without currency symbol, e.g. "999" */
  monthlyAmount: string;
  yearlyAmount: string;
  currencySymbol: string;
  featured?: boolean;
  cta: string;
  href: string;
  features: string[];
};

/** Fallback catalog matching VedMint billing cards (Starter / Business / Enterprise). */
export const PUBLIC_SUBSCRIPTION_PLANS: PublicPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "For small teams getting started with WhatsApp CRM.",
    monthlyAmount: "499",
    yearlyAmount: "4,990",
    currencySymbol: "₹",
    cta: "Start free trial",
    href: "/signup",
    features: [
      "Basic CRM",
      "WhatsApp Inbox",
      "Contact Management",
      "1 WhatsApp Business number",
      "Single-user workspace (no team invites)",
      "No email marketing",
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "For growing businesses with automation needs.",
    monthlyAmount: "999",
    yearlyAmount: "9,990",
    currencySymbol: "₹",
    featured: true,
    cta: "Choose Business",
    href: "/signup",
    features: [
      "Everything in Starter",
      "AI Chat",
      "Bulk WhatsApp",
      "Automation",
      "Up to 10 WhatsApp Business numbers",
      "Email marketing (SMTP, lists, campaigns)",
      "Single-user workspace (no team invites)",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Unlimited scale for large organizations.",
    monthlyAmount: "2,999",
    yearlyAmount: "29,990",
    currencySymbol: "₹",
    cta: "Choose Enterprise",
    href: "/signup",
    features: [
      "Everything in Business",
      "Dedicated Support",
      "Custom Integrations",
      "Unlimited WhatsApp Business numbers",
      "Team invites & multi-agent seats",
      "Email marketing included",
    ],
  },
];

export const CUSTOM_PLAN = {
  id: "custom",
  name: "Custom CRM / ERP",
  description:
    "Fully tailored CRM & ERP modules around your process — not a one-size SaaS template.",
  ctaPhone: "8738871535",
  ctaEmail: "support@vedmint.com",
  features: [
    "WhatsApp Business inbox, templates & broadcasts",
    "Email marketing (SMTP, lists, templates, campaigns)",
    "Custom CRM / ERP modules for your business",
    "Automations, approvals & multi-branch workflows",
    "Dedicated implementation, training & handover",
    "Private cloud or on-prem options",
    "Priority support with SLA options",
  ],
} as const;

export const PRICING_FAQ = [
  {
    q: "Can I change plans later?",
    a: "Yes. After you create an account, open Billing to upgrade, renew, or switch cycles. Only account admins can change the subscription.",
  },
  {
    q: "How does checkout work?",
    a: "Sign up, then choose a plan in Billing. Payments are processed securely via Nimbbl on VedMint. Your workspace unlocks as soon as payment confirms.",
  },
  {
    q: "Are prices shown here final?",
    a: "Public pricing loads live amounts from the VedMint Subscription API when available. After you sign in, Billing shows your exact entitlements, coupons, and checkout total.",
  },
  {
    q: "Do you offer custom CRM / ERP builds?",
    a: "Yes. Contact support for scoped development, integrations, and dedicated onboarding beyond self-serve plans.",
  },
] as const;

const TIER_ORDER = ["starter", "business", "enterprise"] as const;

function formatAmountDigits(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function currencySymbolFor(currency?: string): string {
  const c = String(currency || "INR").toUpperCase();
  if (c === "INR") return "₹";
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  return c;
}

function resolveTierId(plan: VedmintPlan): string | null {
  const input = {
    planName: plan.name,
    planSlug: typeof plan.slug === "string" ? plan.slug : null,
  };
  if (isEnterprisePlan(input)) return "enterprise";
  if (isBusinessPlan(input)) return "business";
  if (isStarterPlan(input)) return "starter";
  // Legacy Growth → Business mid-tier
  const slug = String(plan.slug || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const name = String(plan.name || "").toLowerCase();
  if (slug.includes("growth") || /\bgrowth\b/.test(name)) return "business";
  return null;
}

function fallbackForTier(tierId: string): PublicPlan | undefined {
  return PUBLIC_SUBSCRIPTION_PLANS.find((p) => p.id === tierId);
}

/**
 * Map VedMint API plans onto the public Starter / Business / Enterprise cards.
 * Falls back to static catalog prices/features when API omits fields.
 */
export function mapVedmintPlansToPublic(apiPlans: VedmintPlan[]): PublicPlan[] {
  const byTier = new Map<string, PublicPlan>();

  for (const plan of apiPlans) {
    const tierId = resolveTierId(plan);
    if (!tierId) continue;
    const fallback = fallbackForTier(tierId);
    if (!fallback) continue;

    const monthly = planPrice(plan, "monthly");
    const yearly = planPrice(plan, "yearly");
    const apiFeatures = planFeatureList(plan);

    byTier.set(tierId, {
      ...fallback,
      id: tierId,
      name: plan.name?.trim() || fallback.name,
      description:
        (typeof plan.description === "string" && plan.description.trim()) ||
        fallback.description,
      monthlyAmount:
        monthly.amount != null
          ? formatAmountDigits(monthly.amount)
          : fallback.monthlyAmount,
      yearlyAmount:
        yearly.amount != null
          ? formatAmountDigits(yearly.amount)
          : fallback.yearlyAmount,
      currencySymbol: currencySymbolFor(plan.currency) || fallback.currencySymbol,
      featured:
        Boolean(plan.is_popular || plan.is_featured) ||
        tierId === "business" ||
        fallback.featured,
      features: apiFeatures.length > 0 ? apiFeatures : fallback.features,
      cta: fallback.cta,
      href: fallback.href,
    });
  }

  const ordered = TIER_ORDER.map(
    (id) => byTier.get(id) || fallbackForTier(id)!,
  ).filter(Boolean);

  // Ensure Business stays the featured mid-tier card when API flags are missing.
  if (!ordered.some((p) => p.featured)) {
    const mid = ordered.find((p) => p.id === "business");
    if (mid) mid.featured = true;
  }

  return ordered;
}
