import type { BillingCycle, VedmintPlan } from "@/lib/vedmint-subscription/types";
import { EXPIRING_SOON_DAYS } from "@/lib/vedmint-subscription/entitlements";

export function planFeatureList(plan: VedmintPlan): string[] {
  const raw = plan.features;
  if (Array.isArray(raw)) {
    return raw.map((f) => String(f)).filter(Boolean);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .filter(([, v]) => v === true || typeof v === "string" || typeof v === "number")
      .map(([k, v]) => (v === true ? humanizeKey(k) : `${humanizeKey(k)}: ${String(v)}`));
  }
  if (plan.limits && typeof plan.limits === "object") {
    return Object.entries(plan.limits).map(
      ([k, v]) => `${humanizeKey(k)}: ${v == null ? "—" : String(v)}`,
    );
  }
  return [];
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function planPrice(
  plan: VedmintPlan,
  cycle: BillingCycle,
): { amount: number | null; currency: string; label: string } {
  const currency = String(plan.currency || "INR").toUpperCase();
  const monthly =
    num(plan.monthly_price) ??
    (plan.billing_cycle === "monthly" || plan.interval === "month"
      ? num(plan.price)
      : null);
  const yearly =
    num(plan.yearly_price) ??
    (plan.billing_cycle === "yearly" ||
    plan.billing_cycle === "annual" ||
    plan.interval === "year"
      ? num(plan.price)
      : null);

  if (cycle === "yearly") {
    const amount = yearly ?? (monthly != null ? monthly * 12 : num(plan.price));
    return {
      amount,
      currency,
      label: amount == null ? "Custom" : formatMoney(amount, currency),
    };
  }

  const amount =
    monthly ?? (yearly != null ? Math.round(yearly / 12) : num(plan.price));
  return {
    amount,
    currency,
    label: amount == null ? "Custom" : formatMoney(amount, currency),
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Parse the soonest valid end date from subscription fields. */
export function pickExpiryDate(
  ...candidates: Array<string | Date | null | undefined>
): Date | null {
  let soonest: Date | null = null;
  for (const raw of candidates) {
    if (!raw) continue;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (!soonest || d.getTime() < soonest.getTime()) soonest = d;
  }
  return soonest;
}

export function isPastExpiry(expiresAt?: string | Date | null): boolean {
  if (!expiresAt) return false;
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

export interface ExpiryInfo {
  expiresAt: string | null;
  expired: boolean;
  expiringSoon: boolean;
  daysRemaining: number | null;
}

export function getExpiryInfo(expiresAt?: string | Date | null): ExpiryInfo {
  if (!expiresAt) {
    return {
      expiresAt: null,
      expired: false,
      expiringSoon: false,
      daysRemaining: null,
    };
  }
  const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(d.getTime())) {
    return {
      expiresAt: null,
      expired: false,
      expiringSoon: false,
      daysRemaining: null,
    };
  }
  const ms = d.getTime() - Date.now();
  const expired = ms <= 0;
  const daysRemaining = expired
    ? 0
    : Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return {
    expiresAt: d.toISOString(),
    expired,
    expiringSoon: !expired && daysRemaining <= EXPIRING_SOON_DAYS,
    daysRemaining,
  };
}

/**
 * Active = API says active/trialing AND the period end has not passed.
 * End dates auto-expire the plan even if the remote status lags.
 */
export function isSubscriptionActive(
  status?: string | null,
  activeFlag?: boolean | null,
  expiresAt?: string | Date | null,
): boolean {
  if (isPastExpiry(expiresAt)) return false;
  if (activeFlag === false) return false;
  if (activeFlag === true) return true;
  if (!status) return false;
  const s = status.toLowerCase();
  if (
    s === "expired" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "inactive" ||
    s === "past_due"
  ) {
    return false;
  }
  return s === "active" || s === "trialing" || s === "paid" || s === "success";
}

export function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
