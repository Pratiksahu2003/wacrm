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

/** Parse subscription date values from VedMint (ISO, date-only, unix, DMY). */
export function parseSubscriptionDate(
  raw: string | Date | number | null | undefined,
): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw > 0 && raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  // Date-only: keep calendar day (avoid UTC midnight → previous local day).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, day] = s.split("-").map(Number);
    return new Date(y, m - 1, day, 12, 0, 0, 0);
  }

  // DD/MM/YYYY or DD-MM-YYYY (common in IN locales).
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (dmy) {
    return new Date(
      Number(dmy[3]),
      Number(dmy[2]) - 1,
      Number(dmy[1]),
      12,
      0,
      0,
      0,
    );
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Add one billing period to a start date (defaults to monthly).
 */
export function addBillingPeriod(
  start: Date,
  billingCycle?: string | null,
): Date {
  const end = new Date(start.getTime());
  const cycle = String(billingCycle || "monthly")
    .toLowerCase()
    .trim();
  if (cycle === "yearly" || cycle === "annual" || cycle === "year") {
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }
  // monthly / month / unknown → 1 calendar month
  end.setMonth(end.getMonth() + 1);
  return end;
}

function normalizeBillingCycle(raw?: string | null): "monthly" | "yearly" {
  const cycle = String(raw || "")
    .toLowerCase()
    .trim();
  if (cycle === "yearly" || cycle === "annual" || cycle === "year") {
    return "yearly";
  }
  return "monthly";
}

/**
 * Resolve the subscription period end for display + gating.
 *
 * VedMint `/subscription/status` sometimes returns a short expires_at
 * (e.g. +7 days) even for monthly purchases. We reconstruct the real
 * period from start + billing cycle whenever the API window is too short.
 */
export function resolveSubscriptionPeriodEnd(input: {
  currentPeriodEnd?: string | Date | number | null;
  renewsAt?: string | Date | number | null;
  expiresAt?: string | Date | number | null;
  statusExpiresAt?: string | Date | number | null;
  endsAt?: string | Date | number | null;
  validUntil?: string | Date | number | null;
  nextBillingAt?: string | Date | number | null;
  periodStart?: string | Date | number | null;
  billingCycle?: string | null;
  daysRemaining?: number | null;
  /** Latest paid invoice / purchase date — strongest start signal. */
  purchasedAt?: string | Date | number | null;
}): Date | null {
  const cycle = normalizeBillingCycle(input.billingCycle);

  const prioritized = [
    input.currentPeriodEnd,
    input.renewsAt,
    input.nextBillingAt,
    input.endsAt,
    input.validUntil,
    input.expiresAt,
    input.statusExpiresAt,
  ];

  let fromFields: Date | null = null;
  for (const candidate of prioritized) {
    const d = parseSubscriptionDate(candidate);
    if (d) {
      fromFields = d;
      break;
    }
  }

  // Resolve period start (purchase / invoice / explicit start / back-calc).
  let start =
    parseSubscriptionDate(input.purchasedAt) ||
    parseSubscriptionDate(input.periodStart);

  if (
    !start &&
    fromFields &&
    typeof input.daysRemaining === "number" &&
    Number.isFinite(input.daysRemaining) &&
    input.daysRemaining > 0
  ) {
    start = new Date(fromFields.getTime());
    start.setDate(start.getDate() - Math.ceil(input.daysRemaining));
    start.setHours(12, 0, 0, 0);
  }

  if (!start) {
    start = new Date();
    start.setHours(12, 0, 0, 0);
  }

  const fromCycle = addBillingPeriod(start, cycle);

  // No API end date → use billing cycle math.
  if (!fromFields) return fromCycle;

  const daysLeft = Math.ceil(
    (fromFields.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );

  // Trust API only when the remaining window looks like a full cycle.
  if (cycle === "monthly" && daysLeft >= 25 && daysLeft <= 40) {
    return fromFields;
  }
  if (cycle === "yearly" && daysLeft >= 300 && daysLeft <= 400) {
    return fromFields;
  }

  // Short / weird API window on a monthly|yearly plan → cycle end wins.
  // (This is the 22 Jul purchase → 29 Jul API bug.)
  if (cycle === "monthly" && daysLeft < 25) return fromCycle;
  if (cycle === "yearly" && daysLeft < 300) return fromCycle;

  // Far-future or past API dates: still prefer cycle when we have a purchase start.
  if (parseSubscriptionDate(input.purchasedAt) || parseSubscriptionDate(input.periodStart)) {
    return fromCycle;
  }

  return fromFields;
}

/** @deprecated Prefer resolveSubscriptionPeriodEnd — kept for callers. */
export function pickExpiryDate(
  ...candidates: Array<string | Date | null | undefined>
): Date | null {
  // Prefer the farthest future date so a short/wrong status date
  // cannot override the real billing period end.
  let farthest: Date | null = null;
  for (const raw of candidates) {
    const d = parseSubscriptionDate(raw);
    if (!d) continue;
    if (!farthest || d.getTime() > farthest.getTime()) farthest = d;
  }
  return farthest;
}

export function isPastExpiry(expiresAt?: string | Date | null): boolean {
  if (!expiresAt) return false;
  const d = parseSubscriptionDate(expiresAt);
  if (!d) return false;
  return d.getTime() <= Date.now();
}

export interface ExpiryInfo {
  expiresAt: string | null;
  expired: boolean;
  expiringSoon: boolean;
  daysRemaining: number | null;
}

export function getExpiryInfo(expiresAt?: string | Date | null): ExpiryInfo {
  const d = parseSubscriptionDate(expiresAt ?? null);
  if (!d) {
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
  const s = status.toLowerCase().trim();
  if (
    s === "expired" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "inactive" ||
    s === "past_due" ||
    s === "failed"
  ) {
    return false;
  }
  return (
    s === "active" ||
    s === "trialing" ||
    s === "paid" ||
    s === "success" ||
    s === "subscribed" ||
    s === "completed"
  );
}

export function formatDate(value?: string | null): string | null {
  const d = parseSubscriptionDate(value ?? null);
  if (!d) return null;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
