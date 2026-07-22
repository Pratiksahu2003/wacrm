import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingPageContent } from "@/components/marketing/seo-landing-page";
import { COMPANY_NAME, OFFICIAL_APP_URL, logoUrl } from "@/lib/brand";
import {
  getAllSeoPages,
  getSeoPageBySlug,
  getSeoSlugs,
} from "@/lib/seo/whatsapp-crm-pages";

export const dynamicParams = false;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getSeoSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) {
    return { title: "Not found" };
  }

  const url = `${OFFICIAL_APP_URL}/whatsapp-crm/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    metadataBase: new URL(OFFICIAL_APP_URL),
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: COMPANY_NAME,
      type: "article",
      images: [{ url: logoUrl(), width: 820, height: 304, alt: COMPANY_NAME }],
    },
  };
}

export default async function WhatsappCrmSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getSeoPageBySlug(slug);
  if (!page) notFound();

  const related = getAllSeoPages()
    .filter(
      (p) =>
        p.slug !== page.slug &&
        (p.country === page.country || p.industry === page.industry),
    )
    .slice(0, 6);

  return <SeoLandingPageContent page={page} related={related} />;
}
