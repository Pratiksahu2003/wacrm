import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "@/lib/seo/sitemap";

/**
 * Single authoritative sitemap for all public indexable URLs.
 * Served at /sitemap.xml — includes home, pricing, discover, docs,
 * and ~1,000 WhatsApp CRM SEO landing pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries();
}
