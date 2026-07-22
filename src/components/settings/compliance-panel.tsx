"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Loader2,
  Save,
  ShieldCheck,
  History,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface ComplianceSettings {
  opt_out_keywords: string[];
  opt_in_keywords: string[];
  opt_out_reply: string;
  opt_in_reply: string;
  auto_reply_enabled: boolean;
  exclude_from_broadcasts: boolean;
}

interface OptedOutRow {
  id: string;
  name: string | null;
  phone: string;
  opted_out_at: string | null;
  opt_out_source: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
}

function keywordsToText(list: string[]): string {
  return list.join(", ");
}

function textToKeywords(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function CompliancePanel() {
  const { canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optedOutCount, setOptedOutCount] = useState(0);
  const [optedOut, setOptedOut] = useState<OptedOutRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [settings, setSettings] = useState<ComplianceSettings>({
    opt_out_keywords: ["STOP", "UNSUBSCRIBE", "CANCEL"],
    opt_in_keywords: ["START", "SUBSCRIBE", "YES"],
    opt_out_reply:
      "You’re unsubscribed from marketing messages. Reply START anytime to opt back in.",
    opt_in_reply:
      "You’re subscribed again. Reply STOP anytime to opt out of marketing messages.",
    auto_reply_enabled: true,
    exclude_from_broadcasts: true,
  });
  const [optOutKeywordsText, setOptOutKeywordsText] = useState("");
  const [optInKeywordsText, setOptInKeywordsText] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance", { credentials: "include" });
      const json = (await res.json()) as {
        data?: {
          settings?: ComplianceSettings;
          opted_out_count?: number;
          opted_out?: OptedOutRow[];
          audit?: AuditRow[];
        };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load compliance");
      const s = json.data?.settings;
      if (s) {
        setSettings(s);
        setOptOutKeywordsText(keywordsToText(s.opt_out_keywords || []));
        setOptInKeywordsText(keywordsToText(s.opt_in_keywords || []));
      }
      setOptedOutCount(Number(json.data?.opted_out_count ?? 0));
      setOptedOut(json.data?.opted_out || []);
      setAudit(json.data?.audit || []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load compliance",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async () => {
    if (!canEditSettings) {
      toast.error("Only admins can change compliance settings");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/compliance", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opt_out_keywords: textToKeywords(optOutKeywordsText),
          opt_in_keywords: textToKeywords(optInKeywordsText),
          opt_out_reply: settings.opt_out_reply,
          opt_in_reply: settings.opt_in_reply,
          auto_reply_enabled: settings.auto_reply_enabled,
          exclude_from_broadcasts: settings.exclude_from_broadcasts,
        }),
      });
      const json = (await res.json()) as {
        data?: { settings?: ComplianceSettings };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Save failed");
      if (json.data?.settings) {
        setSettings(json.data.settings);
        setOptOutKeywordsText(
          keywordsToText(json.data.settings.opt_out_keywords || []),
        );
        setOptInKeywordsText(
          keywordsToText(json.data.settings.opt_in_keywords || []),
        );
      }
      toast.success("Compliance settings saved");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleContact = async (contactId: string, optedOut: boolean) => {
    try {
      const res = await fetch("/api/compliance/opt-out", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, opted_out: optedOut }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success(optedOut ? "Contact opted out" : "Contact opted in");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading compliance…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Compliance & DND</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keyword opt-out (STOP), opt-in (START), broadcast exclusion, and
              an audit trail.{" "}
              <span className="font-medium text-foreground">
                {optedOutCount} opted out
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opt-out-keywords">Opt-out keywords</Label>
            <Input
              id="opt-out-keywords"
              value={optOutKeywordsText}
              onChange={(e) => setOptOutKeywordsText(e.target.value)}
              disabled={!canEditSettings}
              placeholder="STOP, UNSUBSCRIBE, CANCEL"
            />
            <p className="text-xs text-muted-foreground">
              Exact match, case-insensitive. Comma-separated.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opt-in-keywords">Opt-in keywords</Label>
            <Input
              id="opt-in-keywords"
              value={optInKeywordsText}
              onChange={(e) => setOptInKeywordsText(e.target.value)}
              disabled={!canEditSettings}
              placeholder="START, SUBSCRIBE, YES"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="opt-out-reply">Opt-out auto-reply</Label>
            <textarea
              id="opt-out-reply"
              value={settings.opt_out_reply}
              onChange={(e) =>
                setSettings((s) => ({ ...s, opt_out_reply: e.target.value }))
              }
              disabled={!canEditSettings}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="opt-in-reply">Opt-in auto-reply</Label>
            <textarea
              id="opt-in-reply"
              value={settings.opt_in_reply}
              onChange={(e) =>
                setSettings((s) => ({ ...s, opt_in_reply: e.target.value }))
              }
              disabled={!canEditSettings}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.auto_reply_enabled}
                disabled={!canEditSettings}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    auto_reply_enabled: e.target.checked,
                  }))
                }
              />
              Send auto-reply on STOP/START
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.exclude_from_broadcasts}
                disabled={!canEditSettings}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    exclude_from_broadcasts: e.target.checked,
                  }))
                }
              />
              Exclude opted-out from broadcasts
            </label>
          </div>
          <Button
            onClick={() => void onSave()}
            disabled={!canEditSettings || saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save settings
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Ban className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Opted-out contacts</h3>
        </div>
        {optedOut.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No opted-out contacts yet. When someone replies STOP, they appear
            here and are skipped in broadcasts.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {optedOut.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.name || row.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.phone}
                    {row.opt_out_source ? ` · ${row.opt_out_source}` : ""}
                    {row.opted_out_at
                      ? ` · ${new Date(row.opted_out_at).toLocaleString("en-IN")}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleContact(row.id, false)}
                >
                  Opt back in
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Audit log</h3>
        </div>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Compliance events will show here (opt-out, opt-in, manual changes).
          </p>
        ) : (
          <ul className="space-y-2">
            {audit.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm",
                )}
              >
                <Badge variant="secondary">{row.action}</Badge>
                <span className="text-muted-foreground">
                  {row.entity_type}
                  {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
