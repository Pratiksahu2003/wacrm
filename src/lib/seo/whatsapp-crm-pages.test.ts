import { describe, expect, it } from "vitest";
import {
  getAllSeoPages,
  getSeoPageBySlug,
  getSeoPageCount,
  getSeoSlugs,
} from "@/lib/seo/whatsapp-crm-pages";

describe("whatsapp-crm SEO pages", () => {
  it("generates about 1000 unique pages", () => {
    const pages = getAllSeoPages();
    expect(getSeoPageCount()).toBe(1000);
    expect(pages).toHaveLength(1000);
    expect(new Set(getSeoSlugs()).size).toBe(1000);
  });

  it("resolves pages by slug with unique metadata", () => {
    const first = getAllSeoPages()[0];
    const found = getSeoPageBySlug(first.slug);
    expect(found?.title).toContain(first.country);
    expect(found?.country).toBeTruthy();
    expect(found?.slug).toContain("-in-");
    expect(found?.description.length).toBeGreaterThan(40);
    expect(found?.benefits.length).toBeGreaterThan(0);
  });
});
