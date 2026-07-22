"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  BillingCycle,
  VedmintInvoice,
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
  invoices: VedmintInvoice[];
  error: string | null;
  code: string | null;
  refresh: () => Promise<void>;
  purchase: (input: {
    planId: number;
    billingCycle: BillingCycle;
    couponCode?: string;
  }) => Promise<{ paymentUrl: string }>;
  cancel: () => Promise<void>;
  downloadInvoice: (invoiceId: string | number) => Promise<void>;
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
  const [configured, setConfigured] = useState(true);
  const [subscription, setSubscription] = useState<VedmintSubscription | null>(
    null,
  );
  const [plans, setPlans] = useState<VedmintPlan[]>([]);
  const [invoices, setInvoices] = useState<VedmintInvoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setCode(null);
    try {
      const [subRes, plansRes, invoicesRes] = await Promise.all([
        fetch("/api/billing/subscription", { credentials: "include" }),
        fetch("/api/billing/plans", { credentials: "include" }),
        fetch("/api/billing/invoices", { credentials: "include" }),
      ]);

      const subJson = await readJson(subRes);
      const plansJson = await readJson(plansRes);
      const invoicesJson = await readJson(invoicesRes);

      if (subRes.ok) {
        const data = (subJson.data || {}) as SubscriptionPayload;
        setConfigured(Boolean(data.configured));
        setSubscription(data.subscription ?? null);
      } else {
        // Do NOT treat account/auth failures as "API not configured".
        const errCode =
          typeof subJson.code === "string" ? subJson.code : null;
        const errMsg = String(subJson.error || "Failed to load subscription");
        setSubscription(null);
        if (errCode === "VEDMINT_NOT_CONFIGURED" || subRes.status === 503) {
          setConfigured(false);
          setCode("VEDMINT_NOT_CONFIGURED");
        } else {
          setConfigured(true);
          setCode(errCode);
        }
        setError(errMsg);
      }

      if (plansRes.ok) {
        const data = (plansJson.data || {}) as { plans?: VedmintPlan[] };
        setPlans(Array.isArray(data.plans) ? data.plans : []);
        if (subRes.ok) {
          // plans loaded → API keys are working
          setConfigured(true);
        }
      } else if (plansRes.status === 503) {
        setConfigured(false);
        setCode("VEDMINT_NOT_CONFIGURED");
        if (subRes.ok) {
          setError(
            String(
              plansJson.error ||
                "VedMint Subscription API is not configured",
            ),
          );
        }
      } else if (subRes.ok) {
        setError(String(plansJson.error || "Failed to load plans"));
        setCode(
          typeof plansJson.code === "string" ? plansJson.code : null,
        );
      }

      if (invoicesRes.ok) {
        const data = (invoicesJson.data || {}) as {
          invoices?: VedmintInvoice[];
        };
        setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      } else if (invoicesRes.status !== 503) {
        // Non-fatal — keep billing usable if invoices endpoint fails.
        setInvoices([]);
      } else {
        setInvoices([]);
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

  const downloadInvoice = useCallback(async (invoiceId: string | number) => {
    const res = await fetch(
      `/api/billing/invoices/${encodeURIComponent(String(invoiceId))}/download`,
      { credentials: "include", cache: "no-store" },
    );

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      const json = await readJson(res);
      throw new Error(String(json.error || "Invoice download failed"));
    }

    if (contentType.includes("application/json")) {
      const json = await readJson(res);
      const data = (json.data || {}) as { url?: string };
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }
      throw new Error("Invoice download URL missing");
    }

    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") || "";
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
    const filename = match
      ? decodeURIComponent(match[1].replace(/"/g, ""))
      : `invoice-${invoiceId}.pdf`;

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }, []);

  return {
    loading,
    refreshing,
    configured,
    subscription,
    plans,
    invoices,
    error,
    code,
    refresh,
    purchase,
    cancel,
    downloadInvoice,
  };
}
