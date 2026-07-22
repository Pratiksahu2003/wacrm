import { describe, expect, it } from "vitest";
import {
  isBusinessPlan,
  isGrowthPlan,
  isStarterPlan,
  TEAM_BUSINESS_ONLY_MESSAGE,
  whatsappNumberLimitForPlan,
  whatsappNumberLimitMessage,
} from "@/lib/vedmint-subscription/entitlements";

describe("isBusinessPlan", () => {
  it("allows Business plan names and slugs", () => {
    expect(isBusinessPlan({ planName: "Business" })).toBe(true);
    expect(isBusinessPlan({ planName: "Business Monthly" })).toBe(true);
    expect(isBusinessPlan({ planName: "VedMint Business" })).toBe(true);
    expect(isBusinessPlan({ planSlug: "business" })).toBe(true);
    expect(isBusinessPlan({ planSlug: "business-yearly" })).toBe(true);
  });

  it("denies Starter, Growth, and custom plans", () => {
    expect(isBusinessPlan({ planName: "Starter" })).toBe(false);
    expect(isBusinessPlan({ planName: "Growth" })).toBe(false);
    expect(isBusinessPlan({ planName: "Custom CRM / ERP" })).toBe(false);
    expect(isBusinessPlan({ planSlug: "starter" })).toBe(false);
    expect(isBusinessPlan({ planSlug: "growth" })).toBe(false);
    expect(isBusinessPlan({ planName: null, planSlug: null })).toBe(false);
  });

  it("exports a clear upgrade message", () => {
    expect(TEAM_BUSINESS_ONLY_MESSAGE.toLowerCase()).toContain("business");
  });
});

describe("whatsappNumberLimitForPlan", () => {
  it("limits Starter to 1, Growth to 10, Business unlimited", () => {
    expect(whatsappNumberLimitForPlan({ planName: "Starter" })).toBe(1);
    expect(whatsappNumberLimitForPlan({ planSlug: "starter" })).toBe(1);
    expect(whatsappNumberLimitForPlan({ planName: "Growth" })).toBe(10);
    expect(whatsappNumberLimitForPlan({ planSlug: "growth-monthly" })).toBe(10);
    expect(whatsappNumberLimitForPlan({ planName: "Business" })).toBeNull();
    expect(whatsappNumberLimitForPlan({ planSlug: "business" })).toBeNull();
  });

  it("defaults unknown plans to Starter (1)", () => {
    expect(whatsappNumberLimitForPlan({ planName: null })).toBe(1);
    expect(whatsappNumberLimitForPlan({ planName: "Pro" })).toBe(1);
  });

  it("detects plan helpers", () => {
    expect(isStarterPlan({ planName: "Starter" })).toBe(true);
    expect(isGrowthPlan({ planName: "Growth Yearly" })).toBe(true);
    expect(whatsappNumberLimitMessage(1)).toMatch(/Starter/i);
    expect(whatsappNumberLimitMessage(10)).toMatch(/10/);
  });
});
