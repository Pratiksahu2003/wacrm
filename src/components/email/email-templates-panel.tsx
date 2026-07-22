"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type { EmailTemplate } from "@/lib/email-marketing/types";

export function EmailTemplatesPanel() {
  const { canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [starterHtml, setStarterHtml] = useState("");
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
      setStarterHtml(json.data?.starter_html ?? "");
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

  const loadStarter = () => {
    setName("Weekly update");
    setSubject("Hello {{name}} — what's new");
    setHtml(starterHtml);
    setEditingId(null);
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
        setName("");
        setSubject("");
        setHtml("");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
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
          <Button variant="outline" size="sm" onClick={loadStarter}>
            Load starter
          </Button>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-subject">Subject</Label>
              <Input
                id="tpl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!canEditSettings}
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
                  "<p style='color:#9ca3af'>Preview appears here</p>",
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Saved templates</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
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
