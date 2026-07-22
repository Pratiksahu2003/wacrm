import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingPageContent } from "@/components/marketing/seo-landing-page";
import {
  COMPANY_NAME,
  OFFICIAL_APP_URL,
  logoUrl,
} from "@/lib/brand";
import {
  getRelatedSeoPages,
  getSeoPageByPath,
  getSeoStaticParams,
} from "@/lib/seo/whatsapp-crm-pages";

export const dynamicParams = false;

type PageProps = {
  params: Promise<{ industry: string; country: string }>;
};

export function generateStaticParams() {
  return getSeoStaticParams();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { industry, country } = await params;
  const page = getSeoPageByPath(industry, country);
  if (!page) return { title: "Not found", robots: { index: false } };

  const url = `${OFFICIAL_APP_URL}${page.path}`;
  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    authors: [{ name: page.authorName, url: "https://www.vedmint.com" }],
    creator: page.authorName,
    publisher: page.publisherName,
    metadataBase: new URL(OFFICIAL_APP_URL),
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: COMPANY_NAME,
      type: "article",
      publishedTime: page.datePublished,
      modifiedTime: page.dateModified,
      authors: [page.authorName],
      locale: "en_US",
      images: [
        {
          url: logoUrl(),
          width: 820,
          height: 304,
          alt: `${COMPANY_NAME} — ${page.headline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [logoUrl()],
    },
    category: "WhatsApp Business CRM",
  };
}

export default async function WhatsappCrmCountryPage({ params }: PageProps) {
  const { industry, country } = await params;
  const page = getSeoPageByPath(industry, country);
  if (!page) notFound();

  const related = getRelatedSeoPages(page, 6);
  return <SeoLandingPageContent page={page} related={related} />;
}
