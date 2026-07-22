"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FileText,
  List,
  Loader2,
  Mail,
  Megaphone,
  Server,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AccountSmtpSettings,
  EmailCampaign,
  EmailList,
  EmailTemplate,
} from "@/lib/email-marketing/types";

export function EmailOverview() {
  const [loading, setLoading] = useState(true);
  const [smtp, setSmtp] = useState<AccountSmtpSettings | null>(null);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [smtpRes, listsRes, tplRes, campRes] = await Promise.all([
          fetch("/api/email/smtp", { credentials: "include" }),
          fetch("/api/email/lists", { credentials: "include" }),
          fetch("/api/email/templates", { credentials: "include" }),
          fetch("/api/email/campaigns", { credentials: "include" }),
        ]);
        const smtpJson = await smtpRes.json();
        const listsJson = await listsRes.json();
        const tplJson = await tplRes.json();
        const campJson = await campRes.json();
        if (cancelled) return;
        setSmtp(smtpJson.data?.settings ?? null);
        setLists(listsJson.data?.lists ?? []);
        setTemplates(tplJson.data?.templates ?? []);
        setCampaigns(campJson.data?.campaigns ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading email marketing…
      </div>
    );
  }

  const recent = campaigns.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Server}
          label="SMTP"
          value={smtp?.verified_at ? "Verified" : smtp ? "Saved" : "Not set"}
          href="/email/smtp"
        />
        <StatCard
          icon={List}
          label="Lists"
          value={String(lists.length)}
          href="/email/lists"
        />
        <StatCard
          icon={FileText}
          label="Templates"
          value={String(templates.length)}
          href="/email/templates"
        />
        <StatCard
          icon={Megaphone}
          label="Campaigns"
          value={String(campaigns.length)}
          href="/email/campaigns"
        />
      </div>

      {!smtp ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Connect your SMTP first</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add Brevo, Gmail, SES, or any SMTP provider, then create lists and
                send campaigns from this workspace.
              </p>
              <Link
                href="/email/smtp"
                className={cn(buttonVariants(), "mt-4 inline-flex")}
              >
                Set up SMTP
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Recent campaigns</h2>
          <Link
            href="/email/campaigns/new"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            New campaign
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaigns yet. Create a list, optionally a template, then send.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/email/campaigns/${c.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {c.sent_count}/{c.total_count} sent
                  </p>
                </div>
                <Badge variant="secondary">{c.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
