import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { vm } from "@/components/marketing/marketing-theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  COMPANY_NAME,
  OFFICIAL_APP_URL,
  PRODUCT_NAME,
  logoUrl,
} from "@/lib/brand";
import {
  COUNTRIES,
  getAllSeoPages,
  getFeaturedSeoPages,
  INDUSTRIES,
} from "@/lib/seo/whatsapp-crm-pages";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: `WhatsApp CRM Guides by Country & Industry — ${PRODUCT_NAME}`,
  description: `Browse ${getAllSeoPages().length}+ WhatsApp CRM guides for industries across countries worldwide. Learn how ${PRODUCT_NAME} helps global teams run shared inbox, pipelines, and broadcasts.`,
  metadataBase: new URL(OFFICIAL_APP_URL),
  alternates: { canonical: `${OFFICIAL_APP_URL}/whatsapp-crm` },
  robots: { index: true, follow: true },
  openGraph: {
    title: `WhatsApp CRM Guides — ${PRODUCT_NAME}`,
    description: `Country and industry guides for WhatsApp Business CRM with VedMint — available worldwide.`,
    url: `${OFFICIAL_APP_URL}/whatsapp-crm`,
    siteName: COMPANY_NAME,
    type: "website",
    images: [{ url: logoUrl(), width: 820, height: 304, alt: COMPANY_NAME }],
  },
};

export default function WhatsappCrmIndexPage() {
  const featured = getFeaturedSeoPages(30);
  const total = getAllSeoPages().length;

  return (
    <MarketingShell theme="light">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Badge variant="secondary" className={cn("mb-4", vm.badge)}>
          {total} SEO guides · worldwide
        </Badge>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          WhatsApp CRM for every country and industry
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          Explore how {PRODUCT_NAME} helps teams worldwide run WhatsApp Business
          conversations with a shared inbox, CRM, pipelines, and automations.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button className={vm.btnPrimary} render={<Link href="/signup" />}>
            Get started
            <ArrowRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className={vm.btnOutline}
            render={<Link href="/pricing" />}
          >
            View pricing
          </Button>
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900">
            Popular guides
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/whatsapp-crm/${page.slug}`}
                  className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:border-teal-200 hover:text-teal-700"
                >
                  {page.industry} in {page.country}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Industries</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {INDUSTRIES.map((industry) => (
                <li key={industry.slug}>
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {industry.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Countries</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {COUNTRIES.map((country) => (
                <li key={country}>
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {country}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
