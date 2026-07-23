import { describe, expect, it } from "vitest";
import {
  EMAIL_MARKETING_PLAN_MESSAGE,
  isBusinessPlan,
  isEnterprisePlan,
  isGrowthPlan,
  isStarterPlan,
  planAllowsEmailMarketing,
  TEAM_ENTERPRISE_ONLY_MESSAGE,
  whatsappNumberLimitForPlan,
  whatsappNumberLimitMessage,
} from "./entitlements";

describe("isEnterprisePlan", () => {
  it("allows Enterprise plan names and slugs", () => {
    expect(isEnterprisePlan({ planName: "Enterprise" })).toBe(true);
    expect(isEnterprisePlan({ planName: "Enterprise Monthly" })).toBe(true);
    expect(isEnterprisePlan({ planSlug: "enterprise" })).toBe(true);
    expect(isEnterprisePlan({ planSlug: "enterprise-yearly" })).toBe(true);
  });

  it("denies Starter and Business", () => {
    expect(isEnterprisePlan({ planName: "Starter" })).toBe(false);
    expect(isEnterprisePlan({ planName: "Business" })).toBe(false);
    expect(isEnterprisePlan({ planSlug: "business" })).toBe(false);
  });
});

describe("isBusinessPlan", () => {
  it("allows Business and legacy Growth as mid-tier", () => {
    expect(isBusinessPlan({ planName: "Business" })).toBe(true);
    expect(isBusinessPlan({ planName: "Business Monthly" })).toBe(true);
    expect(isBusinessPlan({ planSlug: "business" })).toBe(true);
    expect(isBusinessPlan({ planName: "Growth" })).toBe(true);
    expect(isBusinessPlan({ planSlug: "growth-monthly" })).toBe(true);
  });

  it("denies Starter, Enterprise, and custom plans", () => {
    expect(isBusinessPlan({ planName: "Starter" })).toBe(false);
    expect(isBusinessPlan({ planName: "Enterprise" })).toBe(false);
    expect(isBusinessPlan({ planName: "Custom CRM / ERP" })).toBe(false);
    expect(isBusinessPlan({ planSlug: "starter" })).toBe(false);
    expect(isBusinessPlan({ planSlug: "enterprise" })).toBe(false);
    expect(isBusinessPlan({ planName: null, planSlug: null })).toBe(false);
  });

  it("exposes an Enterprise-only team message", () => {
    expect(TEAM_ENTERPRISE_ONLY_MESSAGE.toLowerCase()).toContain("enterprise");
  });
});

describe("whatsappNumberLimitForPlan", () => {
  it("limits Starter to 1, Business to 10, Enterprise unlimited", () => {
    expect(whatsappNumberLimitForPlan({ planName: "Starter" })).toBe(1);
    expect(whatsappNumberLimitForPlan({ planSlug: "starter" })).toBe(1);
    expect(whatsappNumberLimitForPlan({ planName: "Business" })).toBe(10);
    expect(whatsappNumberLimitForPlan({ planSlug: "business" })).toBe(10);
    expect(whatsappNumberLimitForPlan({ planName: "Growth" })).toBe(10);
    expect(whatsappNumberLimitForPlan({ planName: "Enterprise" })).toBeNull();
    expect(whatsappNumberLimitForPlan({ planSlug: "enterprise" })).toBeNull();
  });

  it("defaults unknown plans to Starter (1)", () => {
    expect(whatsappNumberLimitForPlan({ planName: null })).toBe(1);
    expect(whatsappNumberLimitForPlan({ planName: "Pro" })).toBe(1);
  });
});

describe("planAllowsEmailMarketing", () => {
  it("allows Business and Enterprise, denies Starter", () => {
    expect(planAllowsEmailMarketing({ planName: "Business" })).toBe(true);
    expect(planAllowsEmailMarketing({ planName: "Growth" })).toBe(true);
    expect(planAllowsEmailMarketing({ planName: "Enterprise" })).toBe(true);
    expect(planAllowsEmailMarketing({ planName: "Starter" })).toBe(false);
    expect(planAllowsEmailMarketing({ planName: null })).toBe(false);
  });

  it("exposes an upgrade message for email marketing", () => {
    expect(EMAIL_MARKETING_PLAN_MESSAGE.toLowerCase()).toContain("business");
    expect(EMAIL_MARKETING_PLAN_MESSAGE.toLowerCase()).toContain("enterprise");
  });
});

describe("legacy helpers", () => {
  it("maps Growth alias and limit messages", () => {
    expect(isGrowthPlan({ planName: "Growth Yearly" })).toBe(true);
    expect(isStarterPlan({ planName: "Starter" })).toBe(true);
    expect(whatsappNumberLimitMessage(1)).toMatch(/Starter/i);
    expect(whatsappNumberLimitMessage(10)).toMatch(/Enterprise/i);
  });
});
