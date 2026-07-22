import { NextResponse } from "next/server";

import { query } from "@/lib/mysql";
import {
  checkFeature,
  getCurrentSubscription,
  getPlanFeatures,
  getSubscriptionStatus,
} from "@/lib/vedmint-subscription/client";
import { getVedmintConfig } from "@/lib/vedmint-subscription/config";
import { withVedmintToken } from "@/lib/vedmint-subscription/token";
import { VedmintApiError } from "@/lib/vedmint-subscription/types";
import { isSubscriptionActive, getExpiryInfo, pickExpiryDate } from "@/lib/vedmint-subscription/plan-utils";
import { applyLocalPlanExpiry } from "@/lib/vedmint-subscription/expire-local";
import {
  upsertSubscriptionState,
  markExpiredApplied,
} from "@/lib/vedmint-subscription/subscription-state";
import {
  FEATURE_ALIASES,
  featureEnabledInMap,
  pickLimitValue,
  resolveFeatureKey,
  type EntitlementSnapshot,
  type PlanCapability,
  type PlanLimitKey,
} from "@/lib/vedmint-subscription/entitlements";

export type { EntitlementSnapshot };

export class PlanGateError extends Error {
  readonly status: number;
  readonly code: string;
  readonly remaining?: number | null;
  readonly limit?: number | null;
  readonly feature?: string;

  constructor(
    message: string,
    opts: {
      status?: number;
      code?: string;
      remaining?: number | null;
      limit?: number | null;
      feature?: string;
    } = {},
  ) {
    super(message);
    this.name = "PlanGateError";
    this.status = opts.status ?? 403;
    this.code = opts.code ?? "SUBSCRIPTION_INACTIVE";
    this.remaining = opts.remaining;
    this.limit = opts.limit;
    this.feature = opts.feature;
  }
}

export function planGateResponse(err: PlanGateError): NextResponse {
  return NextResponse.json(
    {
      error: err.message,
      code: err.code,
      feature: err.feature,
      remaining: err.remaining ?? null,
      limit: err.limit ?? null,
      upgrade_url: "/billing",
    },
    { status: err.status },
  );
}

export function toPlanAwareErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof PlanGateError) return planGateResponse(err);
  return null;
}

function asFeatureMap(raw: unknown): Record<string, unknown> | string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.features)) return obj.features.map(String);
    if (obj.features && typeof obj.features === "object") {
      return obj.features as Record<string, unknown>;
    }
    return obj;
  }
  return null;
}

function asLimitsMap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  if (obj.limits && typeof obj.limits === "object" && !Array.isArray(obj.limits)) {
    return obj.limits as Record<string, unknown>;
  }
  return obj;
}

async function loadUsage(accountId: string): Promise<Partial<Record<PlanLimitKey, number>>> {
  const [
    contacts,
    members,
    automations,
    activeAutomations,
    flows,
    activeFlows,
    broadcastsMonth,
  ] = await Promise.all([
    query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM contacts WHERE account_id = ?",
      [accountId],
    ),
    query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM profiles WHERE account_id = ?",
      [accountId],
    ),
    query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM automations WHERE account_id = ?",
      [accountId],
    ),
    query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM automations WHERE account_id = ? AND is_active = 1",
      [accountId],
    ),
    query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM flows WHERE account_id = ?",
      [accountId],
    ),
    query<{ c: number }>(
      "SELECT COUNT(*) AS c FROM flows WHERE account_id = ? AND status = 'active'",
      [accountId],
    ),
    query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM broadcasts
       WHERE account_id = ?
         AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
      [accountId],
    ),
  ]);

  return {
    max_contacts: Number(contacts[0]?.c ?? 0),
    max_team_members: Number(members[0]?.c ?? 0),
    max_automations: Number(automations[0]?.c ?? 0),
    max_active_automations: Number(activeAutomations[0]?.c ?? 0),
    max_flows: Number(flows[0]?.c ?? 0),
    max_active_flows: Number(activeFlows[0]?.c ?? 0),
    max_broadcasts_per_month: Number(broadcastsMonth[0]?.c ?? 0),
  };
}

export async function getEntitlementSnapshot(
  userId: string,
  accountId: string,
): Promise<EntitlementSnapshot> {
  const config = getVedmintConfig();
  if (!config.configured) {
    return {
      configured: false,
      active: true,
      status: "unconfigured",
      planName: null,
      planId: null,
      expiresAt: null,
      expired: false,
      expiringSoon: false,
      daysRemaining: null,
      features: {},
      limits: {},
      usage: await loadUsage(accountId),
    };
  }

  try {
    const { result } = await withVedmintToken(userId, async (jwt) => {
      const [status, current, planFeatures] = await Promise.all([
        getSubscriptionStatus(jwt).catch(() => null),
        getCurrentSubscription(jwt).catch(() => null),
        getPlanFeatures(jwt).catch(() => null),
      ]);
      return { status, current, planFeatures };
    });

    const expiryDate = pickExpiryDate(
      result.status?.expires_at as string | undefined,
      result.current?.expires_at as string | undefined,
      result.current?.current_period_end as string | undefined,
      result.current?.renews_at as string | undefined,
    );
    const expiry = getExpiryInfo(expiryDate);

    let active = isSubscriptionActive(
      (result.status?.status as string) ||
        (result.current?.status as string) ||
        undefined,
      typeof result.status?.active === "boolean"
        ? result.status.active
        : undefined,
      expiryDate,
    );

    // Auto-expire: status may still say active while the period ended.
    if (expiry.expired) {
      active = false;
      try {
        await applyLocalPlanExpiry(accountId);
        await markExpiredApplied(accountId);
      } catch (err) {
        console.error(
          "[getEntitlementSnapshot] local expiry apply failed:",
          err,
        );
      }
    }

    const plan =
      result.current?.plan && typeof result.current.plan === "object"
        ? result.current.plan
        : null;

    const statusLabel = expiry.expired
      ? "expired"
      : String(
          result.status?.status ||
            result.current?.status ||
            (active ? "active" : "inactive"),
        );

    const planName =
      (result.current?.plan_name as string) ||
      (plan?.name as string) ||
      (result.status?.plan_name as string) ||
      null;

    try {
      await upsertSubscriptionState({
        accountId,
        userId,
        status: statusLabel,
        planName,
        expiresAt: expiry.expiresAt,
      });
    } catch (err) {
      // Table may not exist until first migrate — don't break entitlements.
      console.warn("[getEntitlementSnapshot] subscription_state upsert:", err);
    }

    const featureRaw =
      asFeatureMap(result.planFeatures) ||
      asFeatureMap(result.current?.features) ||
      asFeatureMap(
        result.current?.plan && typeof result.current.plan === "object"
          ? result.current.plan.features
          : null,
      );

    const limitsRaw = {
      ...asLimitsMap(result.planFeatures),
      ...asLimitsMap(result.current?.limits),
      ...asLimitsMap(
        result.current?.plan && typeof result.current.plan === "object"
          ? result.current.plan.limits || result.current.plan
          : null,
      ),
    };

    const features: Record<string, boolean> = {};
    (Object.keys(FEATURE_ALIASES) as PlanCapability[]).forEach((cap) => {
      const enabled = featureEnabledInMap(featureRaw, cap);
      // If plan does not enumerate features, treat active sub as allowed.
      features[cap] = enabled == null ? active : active && enabled;
    });

    const limits: Record<string, number | null> = {};
    (
      [
        "max_contacts",
        "max_team_members",
        "max_broadcast_recipients",
        "max_broadcasts_per_month",
        "max_automations",
        "max_active_automations",
        "max_flows",
        "max_active_flows",
        "max_messages_per_day",
      ] as PlanLimitKey[]
    ).forEach((key) => {
      limits[key] = pickLimitValue(limitsRaw, key);
    });

    return {
      configured: true,
      active,
      status: statusLabel,
      planName,
      planId:
        Number(result.current?.plan_id) ||
        Number(plan?.id) ||
        Number(result.status?.plan_id) ||
        null,
      expiresAt: expiry.expiresAt,
      expired: expiry.expired,
      expiringSoon: active && expiry.expiringSoon,
      daysRemaining: expiry.daysRemaining,
      features,
      limits,
      usage: await loadUsage(accountId),
    };
  } catch (err) {
    if (
      err instanceof VedmintApiError &&
      (err.code === "SUBSCRIPTION_INACTIVE" || err.status === 403)
    ) {
      return {
        configured: true,
        active: false,
        status: "inactive",
        planName: null,
        planId: null,
        expiresAt: null,
        expired: false,
        expiringSoon: false,
        daysRemaining: null,
        features: {},
        limits: {},
        usage: await loadUsage(accountId),
      };
    }
    throw err;
  }
}

/**
 * Require an active VedMint subscription when the API is configured.
 * Also auto-expires when period end has passed (and pauses local automations/flows).
 * Read-only paths should not call this.
 */
export async function assertActiveSubscription(
  userId: string,
  accountId?: string,
): Promise<void> {
  const config = getVedmintConfig();
  if (!config.configured) return;

  const { result } = await withVedmintToken(userId, async (jwt) => {
    const [status, current] = await Promise.all([
      getSubscriptionStatus(jwt).catch((err) => {
        if (
          err instanceof VedmintApiError &&
          (err.code === "SUBSCRIPTION_INACTIVE" || err.status === 403)
        ) {
          return {
            active: false,
            status: "inactive",
            expires_at: null as string | null,
          };
        }
        return null;
      }),
      getCurrentSubscription(jwt).catch(() => null),
    ]);
    return { status, current };
  });

  const expiryDate = pickExpiryDate(
    result.status && "expires_at" in result.status
      ? (result.status.expires_at as string | null | undefined)
      : undefined,
    result.current?.expires_at as string | undefined,
    result.current?.current_period_end as string | undefined,
    result.current?.renews_at as string | undefined,
  );
  const expiry = getExpiryInfo(expiryDate);

  const active = isSubscriptionActive(
    (result.status?.status as string) ||
      (result.current?.status as string) ||
      undefined,
    typeof result.status?.active === "boolean" ? result.status.active : undefined,
    expiryDate,
  );

  if (!active || expiry.expired) {
    if (accountId && expiry.expired) {
      try {
        await applyLocalPlanExpiry(accountId);
      } catch (err) {
        console.error("[assertActiveSubscription] local expiry failed:", err);
      }
    }
    throw new PlanGateError(
      expiry.expired
        ? "Your subscription plan has expired. Renew to continue using this feature."
        : "Your subscription is inactive. Choose a plan to continue using this feature.",
      {
        code: expiry.expired ? "SUBSCRIPTION_EXPIRED" : "SUBSCRIPTION_INACTIVE",
        status: 403,
      },
    );
  }
}

/**
 * Assert a named plan capability via VedMint check-feature (+ local feature map fallback).
 */
export async function assertPlanCapability(
  userId: string,
  capability: PlanCapability,
  opts?: { quantity?: number; accountId?: string },
): Promise<void> {
  const config = getVedmintConfig();
  if (!config.configured) return;

  await assertActiveSubscription(userId, opts?.accountId);

  const aliases = FEATURE_ALIASES[capability];
  let lastError: unknown = null;

  for (const feature of aliases) {
    try {
      const { result } = await withVedmintToken(userId, (jwt) =>
        checkFeature(jwt, feature),
      );
      if (result.allowed === false) {
        throw new PlanGateError(
          `Your plan does not allow you to ${capability.replace(/_/g, " ")}. Upgrade to continue.`,
          {
            code: "FEATURE_NOT_ALLOWED",
            status: 403,
            feature,
            remaining: result.remaining ?? null,
            limit: result.limit ?? null,
          },
        );
      }
      if (
        opts?.quantity != null &&
        typeof result.remaining === "number" &&
        opts.quantity > result.remaining
      ) {
        throw new PlanGateError(
          `This action needs ${opts.quantity} units but your plan only has ${result.remaining} remaining.`,
          {
            code: "PLAN_LIMIT",
            status: 403,
            feature,
            remaining: result.remaining,
            limit: result.limit ?? null,
          },
        );
      }
      return;
    } catch (err) {
      if (err instanceof PlanGateError) throw err;
      lastError = err;
      // Try next alias if feature key is unknown on the API
      continue;
    }
  }

  // If every check-feature call failed (unknown keys), allow when sub is active.
  if (lastError) {
    console.warn(
      `[assertPlanCapability] check-feature aliases failed for ${capability}; allowing active subscribers`,
      lastError,
    );
  }
}

/**
 * Enforce a numeric plan limit against local usage (+ optional quantity for the current action).
 */
export async function assertPlanLimit(
  userId: string,
  accountId: string,
  limitKey: PlanLimitKey,
  opts?: {
    /** Units this action will consume (default 1). */
    adding?: number;
    /** Override current usage instead of querying. */
    currentUsage?: number;
  },
): Promise<void> {
  const config = getVedmintConfig();
  if (!config.configured) return;

  await assertActiveSubscription(userId, accountId);

  const snap = await getEntitlementSnapshot(userId, accountId);
  const limit = snap.limits[limitKey];
  if (limit == null || !Number.isFinite(limit)) return;

  const usage =
    opts?.currentUsage ??
    snap.usage[limitKey] ??
    0;
  const adding = opts?.adding ?? 1;
  if (usage + adding > limit) {
    throw new PlanGateError(
      `Plan limit reached for ${limitKey.replace(/_/g, " ")} (${usage}/${limit}). Upgrade your plan to continue.`,
      {
        code: "PLAN_LIMIT",
        status: 403,
        feature: limitKey,
        remaining: Math.max(0, limit - usage),
        limit,
      },
    );
  }
}

/** Convenience: active sub + capability (+ optional limit). */
export async function assertCanPerform(
  userId: string,
  accountId: string,
  capability: PlanCapability,
  opts?: {
    limitKey?: PlanLimitKey;
    adding?: number;
    quantity?: number;
  },
): Promise<void> {
  await assertPlanCapability(userId, capability, {
    quantity: opts?.quantity,
    accountId,
  });
  if (opts?.limitKey) {
    await assertPlanLimit(userId, accountId, opts.limitKey, {
      adding: opts.adding,
    });
  }
}

export function resolvePrimaryFeature(capability: PlanCapability): string {
  return resolveFeatureKey(capability);
}
