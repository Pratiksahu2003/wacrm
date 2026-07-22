import {
  assertVedmintConfigured,
  getVedmintConfig,
  type VedmintSubscriptionConfig,
} from "./config";
import {
  VedmintApiError,
  type BillingCycle,
  type VedmintApiEnvelope,
  type VedmintAuthTokenData,
  type VedmintFeatureCheck,
  type VedmintPlan,
  type VedmintPurchaseResult,
  type VedmintSubscription,
  type VedmintSubscriptionStatus,
} from "./types";

type HttpMethod = "GET" | "POST";

interface RequestOptions {
  method?: HttpMethod;
  jwt?: string | null;
  body?: unknown;
  config?: VedmintSubscriptionConfig;
}

function extractErrorMessage(
  payload: VedmintApiEnvelope<unknown> | null,
  fallback: string,
): { message: string; code?: string } {
  if (!payload) return { message: fallback };
  const err = payload.error;
  if (typeof err === "string" && err.trim()) {
    return { message: err, code: payload.code };
  }
  if (err && typeof err === "object") {
    return {
      message: err.message || fallback,
      code: err.code || payload.code,
    };
  }
  if (payload.message) return { message: payload.message, code: payload.code };
  return { message: fallback, code: payload.code };
}

async function vedmintFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const config = assertVedmintConfigured(options.config ?? getVedmintConfig());
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-App-Key": config.key,
    "X-App-Secret": config.secret,
    Origin: config.origin,
  };
  if (options.jwt) {
    headers.Authorization = `Bearer ${options.jwt}`;
  }

  const res = await fetch(`${config.url}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  let payload: VedmintApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as VedmintApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || payload?.success === false) {
    const { message, code } = extractErrorMessage(
      payload,
      `VedMint API request failed (${res.status})`,
    );
    throw new VedmintApiError(message, res.status, code);
  }

  return (payload?.data ?? (payload as unknown as T)) as T;
}

/** Issue a VedMint Subscription API JWT for the signed-in CRM user. */
export async function issueVedmintToken(input: {
  externalUserId: string;
  email: string;
  name?: string | null;
}): Promise<VedmintAuthTokenData> {
  return vedmintFetch<VedmintAuthTokenData>("/auth/token", {
    method: "POST",
    body: {
      // UUID string is the CRM primary key; API accepts string or int.
      external_user_id: input.externalUserId,
      email: input.email,
      name: input.name || undefined,
    },
  });
}

export async function listPlans(jwt: string): Promise<VedmintPlan[]> {
  const data = await vedmintFetch<VedmintPlan[] | { plans: VedmintPlan[] }>(
    "/plans",
    { jwt },
  );
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.plans)) {
    return data.plans;
  }
  return [];
}

export async function getCurrentSubscription(
  jwt: string,
): Promise<VedmintSubscription | null> {
  try {
    return await vedmintFetch<VedmintSubscription>("/subscription/current", {
      jwt,
    });
  } catch (err) {
    if (err instanceof VedmintApiError && (err.status === 404 || err.code === "SUBSCRIPTION_INACTIVE")) {
      return null;
    }
    throw err;
  }
}

export async function getSubscriptionStatus(
  jwt: string,
): Promise<VedmintSubscriptionStatus> {
  return vedmintFetch<VedmintSubscriptionStatus>("/subscription/status", {
    jwt,
  });
}

export async function getPlanFeatures(jwt: string): Promise<unknown> {
  return vedmintFetch("/subscription/features", { jwt });
}

export async function purchaseSubscription(
  jwt: string,
  input: {
    planId: number;
    billingCycle?: BillingCycle;
    couponCode?: string;
    paymentGateway?: string;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<VedmintPurchaseResult> {
  return vedmintFetch<VedmintPurchaseResult>("/subscriptions/purchase", {
    method: "POST",
    jwt,
    body: {
      plan_id: input.planId,
      payment_gateway: input.paymentGateway || "nimbbl",
      billing_cycle: input.billingCycle || "monthly",
      ...(input.couponCode ? { coupon_code: input.couponCode } : {}),
      ...(input.successUrl ? { success_url: input.successUrl } : {}),
      ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
    },
  });
}

export async function cancelSubscription(jwt: string): Promise<unknown> {
  return vedmintFetch("/subscriptions/cancel", { method: "POST", jwt });
}

export async function checkFeature(
  jwt: string,
  feature: string,
): Promise<VedmintFeatureCheck> {
  return vedmintFetch<VedmintFeatureCheck>("/subscription/check-feature", {
    method: "POST",
    jwt,
    body: { feature },
  });
}
