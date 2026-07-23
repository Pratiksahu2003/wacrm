"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type { EmailTemplate } from "@/lib/email-marketing/types";
import { cn } from "@/lib/utils";

type StarterTemplate = {
  id: string;
  name: string;
  subject: string;
  description: string;
  category: string;
  html_body: string;
};

export function EmailTemplatesPanel() {
  const { canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [starters, setStarters] = useState<StarterTemplate[]>([]);
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(
    null,
  );
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/templates", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load templates");
      setTemplates(json.data?.templates ?? []);
      setStarters(json.data?.starter_templates ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load templates",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyStarter = (starter: StarterTemplate) => {
    setSelectedStarterId(starter.id);
    setName(starter.name);
    setSubject(starter.subject);
    setHtml(starter.html_body);
    setEditingId(null);
    toast.success(`Loaded “${starter.name}” — edit and save when ready`);
  };

  const onSave = async () => {
    if (!canEditSettings) {
      toast.error("Only admins can manage templates");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/email/templates/${editingId}`
        : "/api/email/templates";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          html_body: html,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast.success(editingId ? "Template updated" : "Template created");
      setEditingId(null);
      setSelectedStarterId(null);
      setName("");
      setSubject("");
      setHtml("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (tpl: EmailTemplate) => {
    setEditingId(tpl.id);
    setSelectedStarterId(null);
    setName(tpl.name);
    setSubject(tpl.subject);
    setHtml(tpl.html_body);
  };

  const onDelete = async (id: string) => {
    if (!canEditSettings) return;
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/email/templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      toast.success("Template deleted");
      if (editingId === id) {
        setEditingId(null);
        setSelectedStarterId(null);
        setName("");
        setSubject("");
        setHtml("");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const onClearForm = () => {
    setEditingId(null);
    setSelectedStarterId(null);
    setName("");
    setSubject("");
    setHtml("");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading templates…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!editingId && starters.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-teal-600" />
            <div>
              <h2 className="text-base font-semibold">Choose a starter</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a ready-made layout, then edit name, subject, and HTML
                before saving.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {starters.map((starter) => {
              const selected = selectedStarterId === starter.id;
              return (
                <button
                  key={starter.id}
                  type="button"
                  disabled={!canEditSettings}
                  onClick={() => applyStarter(starter)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    selected
                      ? "border-teal-300 bg-teal-50/80 ring-1 ring-teal-200"
                      : "border-border bg-background hover:border-teal-200 hover:bg-muted/40",
                    !canEditSettings && "cursor-not-allowed opacity-60",
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                    {starter.category}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">
                    {starter.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {starter.description}
                  </p>
                  <p className="mt-2 truncate text-[11px] text-muted-foreground/80">
                    {starter.subject}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">
              {editingId ? "Edit template" : "New template"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Merge tags: {"{{name}}"}, {"{{email}}"}, {"{{unsubscribe_url}}"}
            </p>
          </div>
          {(editingId || name || subject || html) && canEditSettings ? (
            <Button variant="outline" size="sm" onClick={onClearForm}>
              Start blank
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEditSettings}
                placeholder="e.g. Welcome email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-subject">Subject</Label>
              <Input
                id="tpl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!canEditSettings}
                placeholder="Hello {{name}}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-html">HTML body</Label>
              <textarea
                id="tpl-html"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                disabled={!canEditSettings}
                rows={14}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
            <Button
              onClick={() => void onSave()}
              disabled={!canEditSettings || saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {editingId ? "Update" : "Create"}
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="min-h-[320px] overflow-auto rounded-lg border border-border bg-white p-4 text-black"
              dangerouslySetInnerHTML={{
                __html:
                  html ||
                  "<p style='color:#9ca3af'>Choose a starter or write HTML to preview</p>",
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Saved templates</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved templates yet. Choose a starter above and click Create.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((tpl) => (
              <li
                key={tpl.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{tpl.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tpl.subject}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(tpl)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onDelete(tpl.id)}
                    disabled={!canEditSettings}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Tip: use templates in{" "}
          <Link href="/email/campaigns/new" className="underline">
            New campaign
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
