import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/auth/account";
import {
  attachVedmintTokenIfNeeded,
  getCurrentSubscription,
  getSubscriptionState,
  getSubscriptionStatus,
  getVedmintConfig,
  listInvoices,
  upsertSubscriptionState,
  withVedmintToken,
} from "@/lib/vedmint-subscription/server";
import { toBillingErrorResponse } from "@/lib/vedmint-subscription/http";
import {
  isSubscriptionActive,
  resolveSubscriptionPeriodEnd,
  getExpiryInfo,
  parseSubscriptionDate,
} from "@/lib/vedmint-subscription/plan-utils";
import type {
  VedmintInvoice,
  VedmintSubscription,
  VedmintSubscriptionStatus,
} from "@/lib/vedmint-subscription/types";

function detectCycleFromInvoice(
  invoices: VedmintInvoice[],
): "monthly" | "yearly" | null {
  for (const inv of invoices) {
    const raw = String(
      inv.billing_cycle ||
        inv.cycle ||
        inv.interval ||
        inv.plan_name ||
        inv.description ||
        "",
    ).toLowerCase();
    if (raw.includes("year") || raw.includes("annual")) return "yearly";
    if (raw.includes("month")) return "monthly";
  }
  return null;
}

function pickLatestPurchaseDate(
  current: VedmintSubscription | null,
  invoices: VedmintInvoice[],
  localPeriodStart?: string | null,
): string | null {
  const candidates: Array<string | null | undefined> = [
    localPeriodStart,
    current?.current_period_start as string | undefined,
    current?.starts_at as string | undefined,
    current?.started_at as string | undefined,
    current?.created_at as string | undefined,
    ...invoices.flatMap((inv) => [
      inv.paid_at,
      inv.issued_at,
      inv.created_at,
    ]),
  ];

  let latest: Date | null = null;
  let latestRaw: string | null = null;
  for (const raw of candidates) {
    const d = parseSubscriptionDate(raw ?? null);
    if (!d) continue;
    if (!latest || d.getTime() > latest.getTime()) {
      latest = d;
      latestRaw = typeof raw === "string" ? raw : d.toISOString();
    }
  }
  return latestRaw;
}

function mergeSubscription(
  current: VedmintSubscription | null,
  status: VedmintSubscriptionStatus | null,
  invoices: VedmintInvoice[] = [],
  local?: {
    billing_cycle?: string | null;
    period_start?: string | null;
  } | null,
): VedmintSubscription | null {
  if (!current && !status) return null;

  const invoiceCycle = detectCycleFromInvoice(invoices);
  const billingCycle =
    (typeof local?.billing_cycle === "string" && local.billing_cycle) ||
    (typeof current?.billing_cycle === "string" && current.billing_cycle) ||
    (current?.plan && typeof current.plan === "object"
      ? String(current.plan.billing_cycle || current.plan.interval || "")
      : "") ||
    (typeof status?.billing_cycle === "string" && status.billing_cycle) ||
    invoiceCycle ||
    "monthly";

  const purchasedAt = pickLatestPurchaseDate(
    current,
    invoices,
    local?.period_start,
  );
  const daysRemaining =
    typeof status?.days_remaining === "number"
      ? status.days_remaining
      : typeof current?.days_remaining === "number"
        ? current.days_remaining
        : null;

  const periodEnd = resolveSubscriptionPeriodEnd({
    currentPeriodEnd:
      (current?.current_period_end as string | undefined) ||
      (current?.period_end as string | undefined) ||
      (current?.end_date as string | undefined) ||
      null,
    renewsAt:
      (current?.renews_at as string | undefined) ||
      (current?.next_billing_at as string | undefined) ||
      (current?.next_payment_date as string | undefined) ||
      null,
    expiresAt:
      (current?.expires_at as string | undefined) ||
      (current?.valid_until as string | undefined) ||
      (current?.valid_till as string | undefined) ||
      null,
    statusExpiresAt: (status?.expires_at as string | undefined) || null,
    endsAt: (current?.ends_at as string | undefined) || null,
    validUntil: (current?.valid_until as string | undefined) || null,
    nextBillingAt: (status?.next_billing_at as string | undefined) || null,
    periodStart:
      local?.period_start ||
      (current?.current_period_start as string | undefined) ||
      (current?.starts_at as string | undefined) ||
      (current?.started_at as string | undefined) ||
      (current?.created_at as string | undefined) ||
      null,
    purchasedAt,
    billingCycle,
    daysRemaining,
  });

  const expiry = getExpiryInfo(periodEnd);
  const expiresAt = expiry.expiresAt;

  const statusLabel =
    (status?.status as string) || (current?.status as string) || undefined;
  const activeFlag =
    typeof status?.active === "boolean"
      ? status.active
      : typeof current?.active === "boolean"
        ? current.active
        : undefined;

  const active = isSubscriptionActive(statusLabel, activeFlag, expiresAt);

  const planId =
    Number(current?.plan_id) ||
    Number(status?.plan_id) ||
    (current?.plan && typeof current.plan === "object"
      ? Number(current.plan.id)
      : NaN);

  const planName =
    current?.plan_name ||
    (current?.plan && typeof current.plan === "object"
      ? String(current.plan.name || "")
      : "") ||
    (typeof status?.plan_name === "string" ? status.plan_name : "") ||
    undefined;

  const normalizedCycle =
    String(billingCycle).toLowerCase().includes("year") ||
    String(billingCycle).toLowerCase().includes("annual")
      ? "yearly"
      : "monthly";

  return {
    ...(current || {}),
    status: statusLabel || (active ? "active" : "inactive"),
    active,
    plan_id: Number.isFinite(planId) && planId > 0 ? planId : current?.plan_id,
    plan_name: planName || undefined,
    billing_cycle: normalizedCycle,
    current_period_start:
      (typeof current?.current_period_start === "string" &&
        current.current_period_start) ||
      purchasedAt,
    expires_at: expiresAt,
    current_period_end: expiresAt,
    renews_at: expiresAt,
    days_remaining: expiry.daysRemaining ?? undefined,
  };
}

export async function GET() {
  try {
    const config = getVedmintConfig();
    if (!config.configured) {
      return NextResponse.json(
        {
          data: {
            configured: false,
            subscription: null,
          },
        },
        { status: 200 },
      );
    }

    const ctx = await getCurrentAccount();
    const local = await getSubscriptionState(ctx.accountId).catch(() => null);

    const { result, freshToken } = await withVedmintToken(
      ctx.userId,
      async (jwt) => {
        const [current, status, invoices] = await Promise.all([
          getCurrentSubscription(jwt),
          getSubscriptionStatus(jwt).catch(() => null),
          listInvoices(jwt).catch(() => [] as VedmintInvoice[]),
        ]);
        return mergeSubscription(current, status, invoices, local);
      },
    );

    if (result) {
      try {
        await upsertSubscriptionState({
          accountId: ctx.accountId,
          userId: ctx.userId,
          status: (result.status as string) || null,
          planName: (result.plan_name as string) || null,
          expiresAt: (result.expires_at as string) || null,
          billingCycle: (result.billing_cycle as string) || null,
          periodStart: (result.current_period_start as string) || null,
        });
      } catch (err) {
        console.warn("[GET /api/billing/subscription] upsert state:", err);
      }
    }

    const response = NextResponse.json({
      data: {
        configured: true,
        subscription: result,
      },
    });
    return attachVedmintTokenIfNeeded(response, freshToken);
  } catch (err) {
    return toBillingErrorResponse(err);
  }
}
