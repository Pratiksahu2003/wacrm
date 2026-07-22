import type { Metadata } from "next";
import { PricingPageContent } from "@/components/marketing/pricing-page";
import {
  COMPANY_NAME,
  OFFICIAL_APP_URL,
  PRODUCT_NAME,
  logoUrl,
} from "@/lib/brand";

export const metadata: Metadata = {
  title: `Pricing & Subscription Plans — ${PRODUCT_NAME}`,
  description: `Compare ${PRODUCT_NAME} subscription plans for WhatsApp Business CRM — Starter, Growth, Business, and custom CRM/ERP development.`,
  metadataBase: new URL(OFFICIAL_APP_URL),
  alternates: { canonical: `${OFFICIAL_APP_URL}/pricing` },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Pricing — ${PRODUCT_NAME}`,
    description: `Subscription plans for shared inbox, contacts, pipelines, broadcasts, and automations.`,
    url: `${OFFICIAL_APP_URL}/pricing`,
    siteName: COMPANY_NAME,
    type: "website",
    images: [{ url: logoUrl(), width: 820, height: 304, alt: COMPANY_NAME }],
  },
};

export default function PricingPage() {
  return <PricingPageContent />;
}
