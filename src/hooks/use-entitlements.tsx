"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  CAPABILITY_LABEL,
  type EntitlementSnapshot,
  type PlanCapability,
  type PlanLimitKey,
} from "@/lib/vedmint-subscription";

interface EntitlementsContextValue {
  loading: boolean;
  configured: boolean;
  active: boolean;
  status: string;
  planName: string | null;
  expiresAt: string | null;
  expired: boolean;
  expiringSoon: boolean;
  daysRemaining: number | null;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  usage: Partial<Record<PlanLimitKey, number>>;
  error: string | null;
  refresh: () => Promise<void>;
  /** True when the capability is allowed (or API unconfigured). */
  canUse: (capability: PlanCapability) => boolean;
  /** True when usage + adding stays within the plan limit (or unlimited). */
  withinLimit: (limitKey: PlanLimitKey, adding?: number) => boolean;
  remaining: (limitKey: PlanLimitKey) => number | null;
  upgradeMessage: (capability?: PlanCapability) => string;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(
  null,
);

const EMPTY_SNAP: EntitlementSnapshot = {
  configured: false,
  active: true,
  status: "unknown",
  planName: null,
  planId: null,
  expiresAt: null,
  expired: false,
  expiringSoon: false,
  daysRemaining: null,
  features: {},
  limits: {},
  usage: {},
};

/** Background poll so expiry is picked up without a full page reload. */
const POLL_MS = 5 * 60 * 1000;

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState<EntitlementSnapshot>(EMPTY_SNAP);
  const [error, setError] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setError(null);
    try {
      const res = await fetch("/api/billing/entitlements", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        data?: EntitlementSnapshot;
        error?: string;
      };
      if (!res.ok) {
        setError(String(json.error || "Failed to load entitlements"));
        setSnap({ ...EMPTY_SNAP, configured: true, active: false, expired: true });
        return;
      }
      if (json.data) setSnap(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entitlements");
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Periodic refresh while the dashboard is open.
  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Exact-time auto-expire: refresh shortly after expiresAt so locks flip live.
  useEffect(() => {
    if (!snap.expiresAt || !snap.active) return;
    const ms = new Date(snap.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(ms)) return;
    if (ms <= 0) {
      void refresh();
      return;
    }
    // setTimeout max ~24.8 days; clamp for longer plans and rely on POLL_MS.
    const delay = Math.min(ms + 1500, 24 * 60 * 60 * 1000);
    const id = window.setTimeout(() => {
      void refresh();
    }, delay);
    return () => window.clearTimeout(id);
  }, [snap.expiresAt, snap.active, refresh]);

  const value = useMemo<EntitlementsContextValue>(() => {
    const canUse = (capability: PlanCapability) => {
      if (!snap.configured) return true;
      if (!snap.active || snap.expired) return false;
      if (capability in snap.features) return Boolean(snap.features[capability]);
      return true;
    };

    const withinLimit = (limitKey: PlanLimitKey, adding = 1) => {
      if (!snap.configured) return true;
      if (!snap.active || snap.expired) return false;
      const limit = snap.limits[limitKey];
      if (limit == null) return true;
      const used = snap.usage[limitKey] ?? 0;
      return used + adding <= limit;
    };

    const remaining = (limitKey: PlanLimitKey) => {
      const limit = snap.limits[limitKey];
      if (limit == null) return null;
      const used = snap.usage[limitKey] ?? 0;
      return Math.max(0, limit - used);
    };

    const upgradeMessage = (capability?: PlanCapability) => {
      if (snap.expired) {
        return "Your subscription plan has expired. Renew to unlock the CRM.";
      }
      if (!snap.active) {
        return "Your subscription is inactive. Choose a plan to unlock the CRM.";
      }
      if (capability) {
        return `Your plan can’t ${CAPABILITY_LABEL[capability]}. Upgrade to continue.`;
      }
      return "Upgrade your plan to unlock this feature.";
    };

    return {
      loading,
      configured: snap.configured,
      active: snap.active,
      status: snap.status,
      planName: snap.planName,
      expiresAt: snap.expiresAt,
      expired: snap.expired,
      expiringSoon: snap.expiringSoon,
      daysRemaining: snap.daysRemaining,
      features: snap.features,
      limits: snap.limits,
      usage: snap.usage,
      error,
      refresh,
      canUse,
      withinLimit,
      remaining,
      upgradeMessage,
    };
  }, [loading, snap, error, refresh]);

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements(): EntitlementsContextValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error("useEntitlements must be used within EntitlementsProvider");
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider. */
export function useEntitlementsOptional(): EntitlementsContextValue | null {
  return useContext(EntitlementsContext);
}
