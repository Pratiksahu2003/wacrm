import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  INDUSTRIES,
  getAllSeoPages,
  getSeoPageByPath,
  getSeoPageCount,
  getSeoStaticParams,
  seoPagePath,
} from "@/lib/seo/whatsapp-crm-pages";

describe("whatsapp-crm SEO pages", () => {
  it("generates 1000 unique country×industry pages", () => {
    expect(COUNTRIES).toHaveLength(50);
    expect(INDUSTRIES).toHaveLength(20);
    expect(getSeoPageCount()).toBe(1000);
    expect(new Set(getAllSeoPages().map((p) => p.path)).size).toBe(1000);
  });

  it("uses nested SEO-friendly URLs", () => {
    const page = getSeoPageByPath("real-estate", "united-states");
    expect(page?.path).toBe("/whatsapp-crm/real-estate/united-states");
    expect(page?.headline).toContain("United States");
    expect(page?.faqs.length).toBeGreaterThanOrEqual(6);
    expect(page?.trustSignals.length).toBeGreaterThan(0);
    expect(page?.expertise.length).toBeGreaterThan(40);
  });

  it("exposes static params for nested routes", () => {
    const params = getSeoStaticParams();
    expect(params).toHaveLength(1000);
    expect(params[0]).toEqual(
      expect.objectContaining({
        industry: expect.any(String),
        country: expect.any(String),
      }),
    );
    expect(seoPagePath("saas", "singapore")).toBe(
      "/whatsapp-crm/saas/singapore",
    );
  });
});
