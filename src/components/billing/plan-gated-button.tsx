"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { GatedButton } from "@/components/ui/gated-button";
import { useEntitlements } from "@/hooks/use-entitlements";
import {
  type PlanCapability,
  type PlanLimitKey,
} from "@/lib/vedmint-subscription";

interface PlanGatedButtonProps
  extends Omit<ComponentProps<typeof GatedButton>, "canAct" | "gateReason"> {
  /** Role gate — same semantics as GatedButton.canAct */
  canAct?: boolean;
  roleReason?: string;
  /** Plan capability required for this action */
  capability?: PlanCapability;
  /** Optional numeric limit that must have remaining capacity */
  limitKey?: PlanLimitKey;
  limitAdding?: number;
  children?: ReactNode;
}

/**
 * Combines role gating + subscription plan gating.
 * When the plan blocks the action, clicking navigates to /billing.
 */
export function PlanGatedButton({
  canAct = true,
  roleReason,
  capability,
  limitKey,
  limitAdding = 1,
  onClick,
  children,
  ...rest
}: PlanGatedButtonProps) {
  const router = useRouter();
  const { loading, canUse, withinLimit, upgradeMessage } = useEntitlements();

  const planOk =
    !capability ||
    (canUse(capability) &&
      (!limitKey || withinLimit(limitKey, limitAdding)));

  const roleOk = canAct;
  const allowed = !loading && roleOk && planOk;

  // GatedButton prefixes roleReason with "Read-only — your role can't …"
  // For plan locks we pass the full message via `title` instead.
  const roleGateReason = !roleOk ? roleReason : undefined;
  const planTitle =
    roleOk && !planOk
      ? capability
        ? upgradeMessage(capability)
        : upgradeMessage()
      : undefined;

  return (
    <GatedButton
      canAct={allowed}
      gateReason={roleGateReason}
      title={planTitle}
      onClick={(e) => {
        if (!allowed) {
          e.preventDefault();
          if (roleOk && !planOk) router.push("/billing");
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </GatedButton>
  );
}

export function PlanUpgradeLink({
  capability,
  className,
}: {
  capability?: PlanCapability;
  className?: string;
}) {
  const { canUse, active, upgradeMessage } = useEntitlements();
  if (active && (!capability || canUse(capability))) return null;
  return (
    <Link
      href="/billing"
      className={
        className ||
        "text-sm font-medium text-primary underline-offset-4 hover:underline"
      }
    >
      {upgradeMessage(capability)}
    </Link>
  );
}
