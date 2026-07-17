"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  UserCog,
  MessageSquare,
  Briefcase,
  Users,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { MyLeadsSummary } from "@/lib/dashboard/my-leads";
import { parseDbDate } from "@/lib/dashboard/safe-date";
import { cn } from "@/lib/utils";

interface MyLeadsPanelProps {
  data: MyLeadsSummary | null;
  loading: boolean;
}

const KIND_ICON = {
  contact: Users,
  conversation: MessageSquare,
  deal: Briefcase,
} as const;

export function MyLeadsPanel({ data, loading }: MyLeadsPanelProps) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const total =
    data.contactCount + data.conversationCount + data.dealCount;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <UserCog className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">My leads</h2>
            <p className="text-xs text-muted-foreground">
              {total === 0
                ? "Nothing assigned to you yet"
                : `${total} item${total === 1 ? "" : "s"} assigned to you`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/contacts?assign=mine"
            className="rounded-full border border-border bg-muted px-2.5 py-1 text-foreground/80 hover:border-primary/30 hover:text-foreground"
          >
            {data.contactCount} contacts
          </Link>
          <Link
            href="/inbox?assign=mine"
            className="rounded-full border border-border bg-muted px-2.5 py-1 text-foreground/80 hover:border-primary/30 hover:text-foreground"
          >
            {data.conversationCount} chats
          </Link>
          <Link
            href="/pipelines"
            className="rounded-full border border-border bg-muted px-2.5 py-1 text-foreground/80 hover:border-primary/30 hover:text-foreground"
          >
            {data.dealCount} deals
          </Link>
        </div>
      </div>

      {data.recent.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Leads assigned to you will show up here. Ask an admin to assign
          contacts from the Contacts page or Inbox.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data.recent.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted",
                      item.kind === "conversation" && "text-[#00a884]",
                      item.kind === "contact" && "text-primary",
                      item.kind === "deal" && "text-blue-400",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/80">
                    {safeRelativeTime(item.at)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function safeRelativeTime(at: string): string {
  const date = parseDbDate(at);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}
