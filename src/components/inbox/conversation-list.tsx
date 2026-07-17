"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus, Profile } from "@/types";
import { Search, ChevronDown, Check, UserCog } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { memberLabel } from "@/components/team/team-member-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  resyncToken?: number;
  /** Deep-link filter, e.g. from /inbox?assign=mine */
  initialAssignFilter?: "all" | "mine" | "unassigned";
  /** Deep-link filter by assignee, e.g. /inbox?agent=<user_id> */
  initialMemberId?: string | null;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground/50",
};

const FILTER_OPTIONS: { label: string; value: ConversationStatus | "all" }[] =
  [
    { label: "All", value: "all" },
    { label: "Open", value: "open" },
    { label: "Pending", value: "pending" },
    { label: "Closed", value: "closed" },
  ];

const ASSIGN_FILTER_OPTIONS: {
  label: string;
  value: "all" | "mine" | "unassigned";
}[] = [
  { label: "All chats", value: "all" },
  { label: "Assigned to me", value: "mine" },
  { label: "Unassigned", value: "unassigned" },
];

function formatListTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd/MM/yyyy");
}

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  initialAssignFilter = "all",
  initialMemberId = null,
}: ConversationListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConversationStatus | "all">("all");
  const [assignFilter, setAssignFilter] = useState<
    "all" | "mine" | "unassigned"
  >(initialMemberId ? "all" : initialAssignFilter);
  const [memberUserId, setMemberUserId] = useState<string | null>(
    initialMemberId,
  );
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { accountId, profileLoading, user } = useAuth();

  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      if (profileLoading) return;
      if (!accountId) {
        onConversationsLoadedRef.current([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .eq("account_id", accountId)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [resyncToken, accountId, profileLoading]);

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
          return;
        }
        setTeamMembers((data as Profile[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncAssignUrl = useCallback(
    (
      nextAssign: "all" | "mine" | "unassigned",
      nextMemberId: string | null,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("assign");
      params.delete("agent");
      if (nextMemberId) {
        params.set("agent", nextMemberId);
      } else if (nextAssign !== "all") {
        params.set("assign", nextAssign);
      }
      const qs = params.toString();
      router.replace(qs ? `/inbox?${qs}` : "/inbox", { scroll: false });
    },
    [router, searchParams],
  );

  const handleAssignPreset = useCallback(
    (value: "all" | "mine" | "unassigned") => {
      setAssignFilter(value);
      setMemberUserId(null);
      syncAssignUrl(value, null);
    },
    [syncAssignUrl],
  );

  const handleAssignMember = useCallback(
    (userId: string) => {
      setAssignFilter("all");
      setMemberUserId(userId);
      syncAssignUrl("all", userId);
    },
    [syncAssignUrl],
  );

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter !== "all") {
      result = result.filter((c) => c.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    if (memberUserId) {
      result = result.filter((c) => c.assigned_agent_id === memberUserId);
    } else if (assignFilter === "mine" && user?.id) {
      result = result.filter((c) => c.assigned_agent_id === user.id);
    } else if (assignFilter === "unassigned") {
      result = result.filter((c) => !c.assigned_agent_id);
    }

    return result;
  }, [conversations, filter, search, assignFilter, memberUserId, user?.id]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    [],
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect],
  );

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);
  const activeAssignFilter = ASSIGN_FILTER_OPTIONS.find(
    (o) => o.value === assignFilter,
  );
  const assignFilterLabel = useMemo(() => {
    if (memberUserId) {
      const name = memberLabel(teamMembers, memberUserId);
      if (name) {
        return memberUserId === user?.id ? `${name} (me)` : name;
      }
      return "Team member";
    }
    return activeAssignFilter?.label ?? "All chats";
  }, [
    memberUserId,
    teamMembers,
    user?.id,
    activeAssignFilter?.label,
  ]);

  return (
    <div className="wa-panel flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border lg:w-[400px]">
      <div className="shrink-0 space-y-2 border-b border-border bg-background p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search or start new chat"
            className="rounded-lg border-none bg-muted pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/50"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            {activeFilter?.label ?? "All"}
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-border bg-popover"
          >
            {FILTER_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "text-sm focus:bg-muted",
                  filter === opt.value ? "text-primary" : "text-foreground",
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <UserCog className="h-3 w-3" />
            <span className="max-w-[140px] truncate">{assignFilterLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-[min(320px,60vh)] overflow-y-auto border-border bg-popover"
          >
            {ASSIGN_FILTER_OPTIONS.map((opt) => {
              const isSelected = !memberUserId && assignFilter === opt.value;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleAssignPreset(opt.value)}
                  className={cn(
                    "text-sm focus:bg-muted",
                    isSelected ? "text-primary" : "text-foreground",
                  )}
                >
                  <span className="flex-1">{opt.label}</span>
                  {isSelected && <Check className="ml-2 h-3 w-3" />}
                </DropdownMenuItem>
              );
            })}
            {teamMembers.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {teamMembers.map((member) => {
                  const isSelected = memberUserId === member.user_id;
                  const label =
                    member.full_name || member.email || "Teammate";
                  return (
                    <DropdownMenuItem
                      key={member.user_id}
                      onClick={() => handleAssignMember(member.user_id)}
                      className={cn(
                        "text-sm focus:bg-muted",
                        isSelected ? "text-primary" : "text-foreground",
                      )}
                    >
                      <span className="flex-1">
                        {label}
                        {member.user_id === user?.id ? " (me)" : ""}
                      </span>
                      {isSelected && <Check className="ml-2 h-3 w-3" />}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !profileLoading && !accountId ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Your profile is not linked to an account
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                assigneeLabel={memberLabel(
                  teamMembers,
                  conv.assigned_agent_id,
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  assigneeLabel?: string | null;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  assigneeLabel,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();
  const hasUnread = conversation.unread_count > 0;

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeLabel = conversation.last_message_at
    ? formatListTime(conversation.last_message_at)
    : "";

  return (
    <button
      onClick={handleClick}
      className={cn(
        "wa-list-hover flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
        isActive && "wa-list-active",
      )}
    >
      <div className="flex h-[49px] w-[49px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-lg font-normal text-primary">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      <div className="min-w-0 flex-1 border-b border-border pb-3 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-[17px] text-foreground",
              hasUnread && "font-medium",
            )}
          >
            {displayName}
          </span>
          <span
            className={cn(
              "shrink-0 text-xs",
              hasUnread ? "text-primary" : "text-muted-foreground",
            )}
          >
            {timeLabel}
          </span>
        </div>
        {assigneeLabel && (
          <p className="mt-0.5 truncate text-[12px] text-primary/80">
            {assigneeLabel}
          </p>
        )}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-[14px]",
              hasUnread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {conversation.last_message_text || "No messages yet"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {hasUnread && (
              <span className="wa-unread-badge flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium">
                {conversation.unread_count > 99
                  ? "99+"
                  : conversation.unread_count}
              </span>
            )}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_COLORS[conversation.status],
              )}
              title={conversation.status}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
