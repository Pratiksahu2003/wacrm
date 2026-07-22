"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Save, Send, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type { AccountSmtpSettings } from "@/lib/email-marketing/types";

export function SmtpSettingsPanel() {
  const { canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AccountSmtpSettings | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [testTo, setTestTo] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/smtp", { credentials: "include" });
      const json = (await res.json()) as {
        data?: { settings?: AccountSmtpSettings | null };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load SMTP");
      const s = json.data?.settings ?? null;
      setSettings(s);
      if (s) {
        setHost(s.host);
        setPort(String(s.port));
        setSecure(s.secure);
        setUsername(s.username);
        setFromName(s.from_name || "");
        setFromEmail(s.from_email);
        setReplyTo(s.reply_to || "");
        setPassword("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load SMTP");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async () => {
    if (!canEditSettings) {
      toast.error("Only admins can change SMTP settings");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/email/smtp", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: Number(port) || 587,
          secure,
          username,
          password: password || undefined,
          from_name: fromName || null,
          from_email: fromEmail,
          reply_to: replyTo || null,
        }),
      });
      const json = (await res.json()) as {
        data?: { settings?: AccountSmtpSettings };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSettings(json.data?.settings ?? null);
      setPassword("");
      toast.success("SMTP settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onVerify = async () => {
    try {
      const res = await fetch("/api/email/smtp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const json = (await res.json()) as {
        data?: { ok?: boolean; error?: string };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Verify failed");
      if (json.data?.ok) {
        toast.success("SMTP connection verified");
        await refresh();
      } else {
        toast.error(json.data?.error || "Verification failed");
        await refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify failed");
    }
  };

  const onTest = async () => {
    if (!testTo.trim()) {
      toast.error("Enter a recipient email for the test");
      return;
    }
    try {
      const res = await fetch("/api/email/smtp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", to: testTo.trim() }),
      });
      const json = (await res.json()) as {
        data?: { ok?: boolean; error?: string };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Test failed");
      if (json.data?.ok) {
        toast.success("Test email sent");
        await refresh();
      } else {
        toast.error(json.data?.error || "Test failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    }
  };

  const onDelete = async () => {
    if (!canEditSettings) return;
    if (!confirm("Remove SMTP settings for this workspace?")) return;
    try {
      const res = await fetch("/api/email/smtp", {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setSettings(null);
      setHost("");
      setPort("587");
      setSecure(false);
      setUsername("");
      setPassword("");
      setFromName("");
      setFromEmail("");
      setReplyTo("");
      toast.success("SMTP settings removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading SMTP…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Your SMTP</h2>
              {settings?.verified_at ? (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="size-3" />
                  Verified
                </Badge>
              ) : settings ? (
                <Badge variant="outline">Not verified</Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Gmail, Brevo, Amazon SES, or any SMTP provider. Marketing
              campaigns send through your credentials — not VedMint’s.
            </p>
            {settings?.last_error ? (
              <p className="mt-2 text-sm text-destructive">{settings.last_error}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="smtp-host">SMTP host</Label>
            <Input
              id="smtp-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={!canEditSettings}
              placeholder="smtp.brevo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-port">Port</Label>
            <Input
              id="smtp-port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={!canEditSettings}
              placeholder="587"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={secure}
                disabled={!canEditSettings}
                onChange={(e) => setSecure(e.target.checked)}
              />
              Use TLS/SSL (port 465)
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-user">Username</Label>
            <Input
              id="smtp-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!canEditSettings}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-pass">
              Password{settings?.has_password ? " (leave blank to keep)" : ""}
            </Label>
            <Input
              id="smtp-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!canEditSettings}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from-name">From name</Label>
            <Input
              id="from-name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={!canEditSettings}
              placeholder="Acme Marketing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from-email">From email</Label>
            <Input
              id="from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              disabled={!canEditSettings}
              placeholder="hello@yourdomain.com"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reply-to">Reply-To (optional)</Label>
            <Input
              id="reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              disabled={!canEditSettings}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void onSave()} disabled={!canEditSettings || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save SMTP
          </Button>
          <Button
            variant="outline"
            onClick={() => void onVerify()}
            disabled={!settings}
          >
            Verify connection
          </Button>
          {settings ? (
            <Button
              variant="outline"
              onClick={() => void onDelete()}
              disabled={!canEditSettings}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold">Send a test email</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@company.com"
            disabled={!settings}
          />
          <Button
            variant="outline"
            onClick={() => void onTest()}
            disabled={!settings}
          >
            <Send className="size-4" />
            Send test
          </Button>
        </div>
      </div>
    </div>
  );
}
