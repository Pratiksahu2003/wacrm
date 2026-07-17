import type { Metadata } from "next";
import { DiscoverPageContent } from "@/components/marketing/discover-page";
import { COMPANY_NAME, OFFICIAL_APP_URL, PRODUCT_NAME, logoUrl } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Discover ${PRODUCT_NAME}`,
  description: `Complete reference for ${PRODUCT_NAME} — dashboard modules, documentation, settings, roles, setup steps, and VedMint ecosystem links.`,
  metadataBase: new URL(OFFICIAL_APP_URL),
  alternates: { canonical: `${OFFICIAL_APP_URL}/discover` },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Discover ${PRODUCT_NAME} — ${COMPANY_NAME}`,
    description: `All dashboard features, docs links, and VedMint ecosystem in one page.`,
    url: `${OFFICIAL_APP_URL}/discover`,
    siteName: COMPANY_NAME,
    type: "website",
    images: [{ url: logoUrl(), width: 820, height: 304, alt: COMPANY_NAME }],
  },
};

export default function DiscoverPage() {
  return <DiscoverPageContent />;
}
