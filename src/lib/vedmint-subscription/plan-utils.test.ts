import { describe, expect, it } from "vitest";

import {
  addBillingPeriod,
  formatDate,
  resolveSubscriptionPeriodEnd,
} from "@/lib/vedmint-subscription/plan-utils";

describe("resolveSubscriptionPeriodEnd", () => {
  it("monthly: 22 Jul purchase → 22 Aug (ignores short +7d API date)", () => {
    const end = resolveSubscriptionPeriodEnd({
      statusExpiresAt: "2026-07-29",
      daysRemaining: 7,
      billingCycle: "monthly",
      purchasedAt: "2026-07-22",
    });

    expect(end).not.toBeNull();
    expect(formatDate(end!.toISOString())).toBe("22 Aug 2026");
  });

  it("yearly: 22 Jul purchase → 22 Jul next year", () => {
    const end = resolveSubscriptionPeriodEnd({
      statusExpiresAt: "2026-07-29",
      daysRemaining: 7,
      billingCycle: "yearly",
      purchasedAt: "2026-07-22",
    });

    expect(end).not.toBeNull();
    expect(formatDate(end!.toISOString())).toBe("22 Jul 2027");
  });

  it("back-calculates start from days_remaining for monthly", () => {
    const end = resolveSubscriptionPeriodEnd({
      statusExpiresAt: "2026-07-29",
      daysRemaining: 7,
      billingCycle: "monthly",
    });

    expect(end).not.toBeNull();
    expect(formatDate(end!.toISOString())).toBe("22 Aug 2026");
  });

  it("trusts a full monthly API window", () => {
    const end = resolveSubscriptionPeriodEnd({
      statusExpiresAt: "2026-08-22",
      daysRemaining: 31,
      billingCycle: "monthly",
      purchasedAt: "2026-07-22",
    });

    expect(end).not.toBeNull();
    expect(formatDate(end!.toISOString())).toBe("22 Aug 2026");
  });

  it("defaults unknown cycle to monthly", () => {
    const start = new Date(2026, 6, 22, 12, 0, 0, 0);
    const end = addBillingPeriod(start, null);
    expect(formatDate(end.toISOString())).toBe("22 Aug 2026");
  });

  it("addBillingPeriod yearly adds one year", () => {
    const start = new Date(2026, 6, 22, 12, 0, 0, 0);
    const end = addBillingPeriod(start, "yearly");
    expect(formatDate(end.toISOString())).toBe("22 Jul 2027");
  });
});
