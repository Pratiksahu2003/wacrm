"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type {
  EmailList,
  EmailTemplate,
} from "@/lib/email-marketing/types";

export function EmailCampaignWizard() {
  const router = useRouter();
  const { canEditSettings } = useAuth();
  const [step, setStep] = useState(1);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [listId, setListId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [lRes, tRes] = await Promise.all([
          fetch("/api/email/lists", { credentials: "include" }),
          fetch("/api/email/templates", { credentials: "include" }),
        ]);
        const lJson = await lRes.json();
        const tJson = await tRes.json();
        setLists(lJson.data?.lists ?? []);
        setTemplates(tJson.data?.templates ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedList = useMemo(
    () => lists.find((l) => l.id === listId) || null,
    [lists, listId],
  );

  useEffect(() => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSubject(tpl.subject);
    setHtml(tpl.html_body);
    if (!name) setName(tpl.name);
  }, [templateId, templates, name]);

  const onSend = async () => {
    if (!canEditSettings) {
      toast.error("Only admins can send campaigns");
      return;
    }
    if (!listId || !subject.trim() || !html.trim()) {
      toast.error("List, subject, and HTML are required");
      return;
    }
    setSending(true);
    try {
      const createRes = await fetch("/api/email/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || subject.trim(),
          list_id: listId,
          template_id: templateId || null,
          subject: subject.trim(),
          html_body: html,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createJson.error || "Could not create campaign");
      }
      const campaignId = createJson.data?.campaign?.id as string;
      const startRes = await fetch(`/api/email/campaigns/${campaignId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          scheduled_at: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
        }),
      });
      const startJson = await startRes.json();
      if (!startRes.ok) {
        throw new Error(startJson.error || "Could not start campaign");
      }
      toast.success(
        scheduledAt ? "Campaign scheduled" : "Campaign sending started",
      );
      router.push(`/email/campaigns/${campaignId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading wizard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-xs font-medium text-muted-foreground">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={
              step === n
                ? "rounded-full bg-primary px-2.5 py-1 text-primary-foreground"
                : "rounded-full bg-muted px-2.5 py-1"
            }
          >
            Step {n}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold">Choose list</h2>
          {lists.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create an email list first.
            </p>
          ) : (
            <div className="space-y-2">
              {lists.map((list) => (
                <label
                  key={list.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="list"
                    checked={listId === list.id}
                    onChange={() => setListId(list.id)}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{list.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {list.subscriber_count} subscribed
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <Button disabled={!listId} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold">Compose</h2>
          <div className="space-y-2">
            <Label>Template (optional)</Label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Write from scratch</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="camp-name">Campaign name</Label>
            <Input
              id="camp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="camp-subject">Subject</Label>
            <Input
              id="camp-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="camp-html">HTML</Label>
              <textarea
                id="camp-html"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="min-h-[280px] overflow-auto rounded-lg border border-border bg-white p-4 text-black"
                dangerouslySetInnerHTML={{
                  __html: html || "<p style='color:#9ca3af'>Preview</p>",
                }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              disabled={!subject.trim() || !html.trim()}
              onClick={() => setStep(3)}
            >
              Review
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold">Review & send</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">List</dt>
              <dd className="font-medium">
                {selectedList?.name} ({selectedList?.subscriber_count})
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Subject</dt>
              <dd className="font-medium text-right">{subject}</dd>
            </div>
          </dl>
          <div className="space-y-2">
            <Label htmlFor="sched">Schedule (optional, local time)</Label>
            <Input
              id="sched"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={() => void onSend()}
              disabled={!canEditSettings || sending}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {scheduledAt ? "Schedule" : "Send now"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
