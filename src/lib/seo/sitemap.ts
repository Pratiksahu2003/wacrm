import type { MetadataRoute } from "next";
import { logoUrl, OFFICIAL_APP_URL } from "@/lib/brand";
import { DOC_PAGES } from "@/lib/docs/content";
import { getAllSeoPages, INDUSTRIES } from "@/lib/seo/whatsapp-crm-pages";

export type SitemapChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]["changeFrequency"]
>;

export type SitemapEntryInput = {
  path: string;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
  /** ISO date (YYYY-MM-DD) when this URL’s content last meaningfully changed. */
  lastModified: string;
  images?: string[];
};

/**
 * Stable lastmod dates — update when the corresponding page content changes.
 * Avoid `new Date()` on every request; fluctuating lastmod looks unreliable to crawlers.
 */
export const SITEMAP_DATES = {
  home: "2026-07-22",
  pricing: "2026-07-22",
  discover: "2026-07-22",
  docs: "2026-07-01",
  seoHub: "2026-07-22",
  seoPages: "2026-07-22",
} as const;

function absoluteUrl(path: string): string {
  const base = OFFICIAL_APP_URL.replace(/\/+$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function toEntry(input: SitemapEntryInput): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(input.path),
    lastModified: new Date(`${input.lastModified}T00:00:00.000Z`),
    changeFrequency: input.changeFrequency,
    priority: input.priority,
    ...(input.images?.length ? { images: input.images } : {}),
  };
}

/** Core public marketing + docs URLs (highest crawl priority). */
export function getCoreSitemapInputs(): SitemapEntryInput[] {
  return [
    {
      path: "/",
      changeFrequency: "weekly",
      priority: 1,
      lastModified: SITEMAP_DATES.home,
      images: [logoUrl()],
    },
    {
      path: "/pricing",
      changeFrequency: "weekly",
      priority: 0.95,
      lastModified: SITEMAP_DATES.pricing,
    },
    {
      path: "/discover",
      changeFrequency: "monthly",
      priority: 0.85,
      lastModified: SITEMAP_DATES.discover,
    },
    {
      path: "/whatsapp-crm",
      changeFrequency: "weekly",
      priority: 0.85,
      lastModified: SITEMAP_DATES.seoHub,
    },
    ...DOC_PAGES.map((doc) => ({
      path: doc.href,
      changeFrequency: "monthly" as const,
      priority: doc.slug === "getting-started" ? 0.8 : 0.7,
      lastModified: SITEMAP_DATES.docs,
    })),
  ];
}

/** Programmatic SEO landing pages (~1k) + industry hubs. */
export function getSeoSitemapInputs(): SitemapEntryInput[] {
  const industryHubs = INDUSTRIES.map((industry) => ({
    path: `/whatsapp-crm/${industry.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
    lastModified: SITEMAP_DATES.seoPages,
  }));

  const countryPages = getAllSeoPages().map((page) => ({
    path: page.path,
    changeFrequency: "monthly" as const,
    priority: 0.65,
    lastModified: SITEMAP_DATES.seoPages,
  }));

  return [...industryHubs, ...countryPages];
}

/**
 * Full public sitemap: core pages first, then SEO guides.
 * Deduped by URL and sorted for stable output.
 */
export function buildSitemapEntries(): MetadataRoute.Sitemap {
  const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const input of [...getCoreSitemapInputs(), ...getSeoSitemapInputs()]) {
    const entry = toEntry(input);
    byUrl.set(entry.url, entry);
  }

  return [...byUrl.values()].sort((a, b) => {
    const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    return a.url.localeCompare(b.url);
  });
}

export function getSitemapUrlCount(): number {
  return buildSitemapEntries().length;
}

/** Sitemap index URL for robots.txt and Search Console. */
export function getSitemapIndexUrl(): string {
  return absoluteUrl("/sitemap.xml");
}
