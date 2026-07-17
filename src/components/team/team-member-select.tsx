"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface TeamMemberSelectProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  allowUnassigned?: boolean;
  unassignedLabel?: string;
  className?: string;
  id?: string;
}

/**
 * Dropdown of account teammates. Values are auth `user_id`s — the same
 * id stored on conversations.assigned_agent_id and contacts.assigned_to.
 */
export function TeamMemberSelect({
  value,
  onChange,
  disabled = false,
  allowUnassigned = true,
  unassignedLabel = "Unassigned",
  className,
  id,
}: TeamMemberSelectProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load team members:", error);
        }
        setMembers((data as Profile[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-border bg-muted px-2.5 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading team…
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value ?? ""}
      disabled={disabled || members.length === 0}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(
        "h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {allowUnassigned && <option value="">{unassignedLabel}</option>}
      {members.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.full_name || m.email || "Teammate"}
        </option>
      ))}
    </select>
  );
}

/** Resolve display name for a user_id from a preloaded roster. */
export function memberLabel(
  members: Profile[],
  userId: string | null | undefined,
): string | null {
  if (!userId) return null;
  const m = members.find((p) => p.user_id === userId);
  return m?.full_name || m?.email || null;
}
