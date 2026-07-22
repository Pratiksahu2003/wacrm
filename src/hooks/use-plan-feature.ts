"use client";

import { useCallback, useEffect, useState } from "react";

interface FeatureGateState {
  loading: boolean;
  allowed: boolean;
  remaining: number | null;
  limit: number | null;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Client helper for VedMint `POST /subscription/check-feature`.
 * Use before premium actions (e.g. AI credits, broadcast caps).
 */
export function usePlanFeature(feature: string | null): FeatureGateState {
  const [loading, setLoading] = useState(Boolean(feature));
  const [allowed, setAllowed] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!feature) {
      setLoading(false);
      setAllowed(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/check-feature", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      const json = (await res.json()) as {
        data?: {
          allowed?: boolean;
          remaining?: number | null;
          limit?: number | null;
        };
        error?: string;
      };
      if (!res.ok) {
        setAllowed(false);
        setError(String(json.error || "Feature check failed"));
        return;
      }
      setAllowed(Boolean(json.data?.allowed));
      setRemaining(
        typeof json.data?.remaining === "number" ? json.data.remaining : null,
      );
      setLimit(typeof json.data?.limit === "number" ? json.data.limit : null);
    } catch (err) {
      setAllowed(false);
      setError(err instanceof Error ? err.message : "Feature check failed");
    } finally {
      setLoading(false);
    }
  }, [feature]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, allowed, remaining, limit, error, refresh };
}
