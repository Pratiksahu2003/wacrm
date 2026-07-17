"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { MessageReaction } from "@/types";

interface MessageReactionsProps {
  reactions: MessageReaction[];
  currentUserId: string | undefined;
  /** Toggle the agent's reaction. If the agent already has this emoji →
   *  caller should send empty to remove; otherwise swap/add. */
  onToggle: (emoji: string) => void;
  isOutgoing?: boolean;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  byCurrentUser: boolean;
}

function groupReactions(
  reactions: MessageReaction[],
  currentUserId: string | undefined,
): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions) {
    const existing = map.get(r.emoji);
    const isMine =
      r.actor_type === "agent" &&
      !!currentUserId &&
      r.actor_id === currentUserId;
    if (existing) {
      existing.count += 1;
      existing.byCurrentUser = existing.byCurrentUser || isMine;
    } else {
      map.set(r.emoji, { emoji: r.emoji, count: 1, byCurrentUser: isMine });
    }
  }
  return [...map.values()];
}

export function MessageReactions({
  reactions,
  currentUserId,
  onToggle,
  isOutgoing = false,
}: MessageReactionsProps) {
  const groups = useMemo(
    () => groupReactions(reactions, currentUserId),
    [reactions, currentUserId],
  );

  if (groups.length === 0) return null;

  return (
    <div
      className={cn(
        "-mt-2 flex flex-wrap gap-0.5",
        isOutgoing ? "mr-2 justify-end" : "ml-2 justify-start",
      )}
    >
      {groups.map((g) => (
        <button
          key={g.emoji}
          type="button"
          onClick={() => onToggle(g.emoji)}
          aria-pressed={g.byCurrentUser}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] leading-none shadow-sm transition-colors",
            g.byCurrentUser
              ? "border-primary/50 bg-card text-foreground hover:bg-muted"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          <span className="text-[13px] leading-none">{g.emoji}</span>
          {g.count > 1 && (
            <span className="text-[11px] text-muted-foreground">{g.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
