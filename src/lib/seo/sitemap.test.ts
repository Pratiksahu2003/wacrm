import { describe, expect, it } from "vitest";
import { OFFICIAL_APP_URL } from "@/lib/brand";
import { DOC_PAGES } from "@/lib/docs/content";
import {
  buildSitemapEntries,
  getCoreSitemapInputs,
  getSeoSitemapInputs,
  getSitemapIndexUrl,
  getSitemapUrlCount,
} from "@/lib/seo/sitemap";
import { getSeoPageCount } from "@/lib/seo/whatsapp-crm-pages";

describe("sitemap", () => {
  it("includes every public core + SEO URL exactly once", () => {
    const entries = buildSitemapEntries();
    const urls = entries.map((e) => e.url);
    const expectedCore = 1 + 1 + 1 + 1 + DOC_PAGES.length; // home, pricing, discover, hub, docs
    const expected = expectedCore + getSeoPageCount();

    expect(getSitemapUrlCount()).toBe(expected);
    expect(urls).toHaveLength(expected);
    expect(new Set(urls).size).toBe(expected);
  });

  it("uses absolute canonical URLs on the production host", () => {
    const entries = buildSitemapEntries();
    for (const entry of entries) {
      expect(entry.url.startsWith(OFFICIAL_APP_URL)).toBe(true);
      expect(entry.url.endsWith("/")).toBe(false);
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
      expect(entry.changeFrequency).toBeTruthy();
    }
  });

  it("ranks homepage and pricing highest", () => {
    const entries = buildSitemapEntries();
    expect(entries[0]?.url).toBe(OFFICIAL_APP_URL);
    expect(entries[0]?.priority).toBe(1);
    expect(entries[1]?.url).toBe(`${OFFICIAL_APP_URL}/pricing`);
    expect(entries[1]?.priority).toBeGreaterThanOrEqual(0.9);
  });

  it("covers all SEO landing pages under /whatsapp-crm/", () => {
    const seoPaths = new Set(getSeoSitemapInputs().map((i) => i.path));
    expect(seoPaths.size).toBe(1000);
    for (const path of seoPaths) {
      expect(path.startsWith("/whatsapp-crm/whatsapp-crm-for-")).toBe(true);
    }
  });

  it("exposes a single sitemap index URL for robots", () => {
    expect(getSitemapIndexUrl()).toBe(`${OFFICIAL_APP_URL}/sitemap.xml`);
    expect(getCoreSitemapInputs().length).toBeGreaterThanOrEqual(4);
  });
});
