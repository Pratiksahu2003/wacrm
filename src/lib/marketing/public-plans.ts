/** Public marketing plans shown on /pricing (checkout happens after signup). */

export type PublicPlan = {
  id: string;
  name: string;
  description: string;
  monthlyLabel: string;
  yearlyLabel: string;
  featured?: boolean;
  cta: string;
  href: string;
  features: string[];
};

export const PUBLIC_SUBSCRIPTION_PLANS: PublicPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description:
      "For small teams getting started with WhatsApp Business and a shared inbox.",
    monthlyLabel: "From ₹999",
    yearlyLabel: "From ₹9,990",
    cta: "Start free trial",
    href: "/signup",
    features: [
      "Shared WhatsApp team inbox",
      "Contacts, tags & CSV import",
      "Basic sales pipelines",
      "Approved template messages",
      "1 WhatsApp Business number",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description:
      "For growing sales and support teams that need broadcasts and automations.",
    monthlyLabel: "From ₹2,499",
    yearlyLabel: "From ₹24,990",
    featured: true,
    cta: "Choose Growth",
    href: "/signup",
    features: [
      "Everything in Starter",
      "Template broadcasts & audience segments",
      "No-code automations & conversation flows",
      "Deal pipelines with assignment",
      "Delivery & read tracking",
      "Priority email support",
    ],
  },
  {
    id: "business",
    name: "Business",
    description:
      "For multi-agent workspaces that need higher limits and stronger controls.",
    monthlyLabel: "From ₹4,999",
    yearlyLabel: "From ₹49,990",
    cta: "Choose Business",
    href: "/signup",
    features: [
      "Everything in Growth",
      "Higher message & contact limits",
      "Role-based access (Owner, Admin, Agent, Viewer)",
      "Compliance tools & audit-friendly workflows",
      "Advanced reporting & exports",
      "Priority onboarding assistance",
    ],
  },
];

export const CUSTOM_PLAN = {
  id: "custom",
  name: "Custom CRM / ERP",
  description:
    "Fully tailored CRM & ERP modules around your process — not a one-size SaaS template.",
  monthlyLabel: "Custom quote",
  yearlyLabel: "Custom quote",
  ctaPhone: "8738871535",
  ctaEmail: "support@vedmint.com",
  features: [
    "WhatsApp Business inbox, templates & broadcasts",
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
    a: "Marketing prices are starting points. Live plan amounts, coupons, and entitlements are loaded from VedMint Billing after you sign in.",
  },
  {
    q: "Do you offer custom CRM / ERP builds?",
    a: "Yes. Contact support for scoped development, integrations, and dedicated onboarding beyond self-serve plans.",
  },
] as const;
