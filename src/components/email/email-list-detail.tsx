"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Trash2, Upload, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type { EmailList, EmailSubscriber } from "@/lib/email-marketing/types";

export function EmailListDetail({ listId }: { listId: string }) {
  const { canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<EmailList | null>(null);
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [subscribeUrl, setSubscribeUrl] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/lists/${listId}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load list");
      setList(json.data?.list ?? null);
      setSubscribers(json.data?.subscribers ?? []);
      setSubscribeUrl(json.data?.subscribe_url ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyUrl = async () => {
    if (!subscribeUrl) return;
    await navigator.clipboard.writeText(subscribeUrl);
    toast.success("Subscribe URL copied");
  };

  const addOne = async () => {
    if (!canEditSettings) return;
    try {
      const res = await fetch(`/api/email/lists/${listId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Add failed");
      setEmail("");
      setName("");
      toast.success(json.data?.created ? "Subscriber added" : "Already on list");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    }
  };

  const importCsv = async () => {
    if (!canEditSettings) return;
    try {
      const res = await fetch(`/api/email/lists/${listId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", csv }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      toast.success(
        `Imported ${json.data?.added ?? 0} · skipped ${json.data?.skipped ?? 0} · invalid ${json.data?.invalid ?? 0}`,
      );
      setCsv("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  const removeList = async () => {
    if (!canEditSettings) return;
    if (!confirm("Delete this list and all subscribers?")) return;
    try {
      const res = await fetch(`/api/email/lists/${listId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      toast.success("List deleted");
      window.location.href = "/email/lists";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading list…
      </div>
    );
  }

  if (!list) {
    return <p className="text-sm text-muted-foreground">List not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{list.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {list.subscriber_count} subscribed
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void removeList()}
            disabled={!canEditSettings}
          >
            <Trash2 className="size-4" />
            Delete list
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input value={subscribeUrl} readOnly className="font-mono text-xs" />
          <Button variant="outline" onClick={() => void copyUrl()}>
            <Copy className="size-4" />
            Copy form URL
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">Add subscriber</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="sub-email">Email</Label>
              <Input
                id="sub-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-name">Name</Label>
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <Button
              onClick={() => void addOne()}
              disabled={!canEditSettings}
            >
              <UserPlus className="size-4" />
              Add
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">Import CSV</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Header optional. Columns: <code>email,name</code>
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            disabled={!canEditSettings}
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            placeholder={"email,name\nalice@example.com,Alice"}
          />
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void importCsv()}
            disabled={!canEditSettings || !csv.trim()}
          >
            <Upload className="size-4" />
            Import
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold">Subscribers</h3>
        {subscribers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscribers yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {subscribers.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.name || s.email}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{s.status}</Badge>
                  <Badge variant="outline">{s.source}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
