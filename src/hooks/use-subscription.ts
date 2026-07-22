"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  BillingCycle,
  VedmintPlan,
  VedmintSubscription,
} from "@/lib/vedmint-subscription";

interface SubscriptionPayload {
  configured: boolean;
  subscription: VedmintSubscription | null;
}

interface UseSubscriptionState {
  loading: boolean;
  refreshing: boolean;
  configured: boolean;
  subscription: VedmintSubscription | null;
  plans: VedmintPlan[];
  error: string | null;
  code: string | null;
  refresh: () => Promise<void>;
  purchase: (input: {
    planId: number;
    billingCycle: BillingCycle;
    couponCode?: string;
  }) => Promise<{ paymentUrl: string }>;
  cancel: () => Promise<void>;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function useSubscription(): UseSubscriptionState {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [subscription, setSubscription] = useState<VedmintSubscription | null>(
    null,
  );
  const [plans, setPlans] = useState<VedmintPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setCode(null);
    try {
      const [subRes, plansRes] = await Promise.all([
        fetch("/api/billing/subscription", { credentials: "include" }),
        fetch("/api/billing/plans", { credentials: "include" }),
      ]);

      const subJson = await readJson(subRes);
      if (!subRes.ok) {
        setConfigured(false);
        setSubscription(null);
        setError(String(subJson.error || "Failed to load subscription"));
        setCode(typeof subJson.code === "string" ? subJson.code : null);
      } else {
        const data = (subJson.data || {}) as SubscriptionPayload;
        setConfigured(Boolean(data.configured));
        setSubscription(data.subscription ?? null);
      }

      if (plansRes.ok) {
        const plansJson = await readJson(plansRes);
        const data = (plansJson.data || {}) as { plans?: VedmintPlan[] };
        setPlans(Array.isArray(data.plans) ? data.plans : []);
      } else if (plansRes.status !== 503) {
        const plansJson = await readJson(plansRes);
        if (!subRes.ok) {
          // keep subscription error
        } else {
          setError(String(plansJson.error || "Failed to load plans"));
          setCode(typeof plansJson.code === "string" ? plansJson.code : null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const purchase = useCallback(
    async (input: {
      planId: number;
      billingCycle: BillingCycle;
      couponCode?: string;
    }) => {
      const res = await fetch("/api/billing/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: input.planId,
          billing_cycle: input.billingCycle,
          coupon_code: input.couponCode || undefined,
        }),
      });
      const json = await readJson(res);
      if (!res.ok) {
        const message = String(json.error || "Purchase failed");
        const err = new Error(message) as Error & { code?: string };
        err.code = typeof json.code === "string" ? json.code : undefined;
        throw err;
      }
      const data = (json.data || {}) as { payment_url?: string };
      if (!data.payment_url) {
        throw new Error("No payment URL returned");
      }
      return { paymentUrl: data.payment_url };
    },
    [],
  );

  const cancel = useCallback(async () => {
    const res = await fetch("/api/billing/cancel", {
      method: "POST",
      credentials: "include",
    });
    const json = await readJson(res);
    if (!res.ok) {
      throw new Error(String(json.error || "Cancel failed"));
    }
    await refresh();
  }, [refresh]);

  return {
    loading,
    refreshing,
    configured,
    subscription,
    plans,
    error,
    code,
    refresh,
    purchase,
    cancel,
  };
}
