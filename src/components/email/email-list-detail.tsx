"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, FileUp, Loader2, Trash2, Upload, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type { EmailList, EmailSubscriber } from "@/lib/email-marketing/types";

export function EmailListDetail({ listId }: { listId: string }) {
  const { canEditSettings } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<EmailList | null>(null);
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [subscribeUrl, setSubscribeUrl] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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

  const runImport = async (csvText: string) => {
    if (!canEditSettings) return;
    const trimmed = csvText.trim();
    if (!trimmed) {
      toast.error("Choose a CSV file or paste CSV text first");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch(`/api/email/lists/${listId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "text/csv; charset=utf-8" },
        body: trimmed,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      toast.success(
        `Imported ${json.data?.added ?? 0} · skipped ${json.data?.skipped ?? 0} · invalid ${json.data?.invalid ?? 0}`,
      );
      setCsv("");
      setCsvFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const onPickCsvFile = async (file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".csv") &&
      !file.type.includes("csv") &&
      !file.type.includes("text/plain") &&
      file.type !== ""
    ) {
      toast.error("Please upload a .csv file");
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        toast.error("CSV file is empty");
        return;
      }
      setCsv(text);
      setCsvFileName(file.name);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error("Could not read CSV file");
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{list.name}</h1>
          {list.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {list.description}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {list.subscriber_count} subscribers
          </p>
        </div>
        {canEditSettings ? (
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => void removeList()}
          >
            <Trash2 className="size-4" />
            Delete list
          </Button>
        ) : null}
      </div>

      {subscribeUrl ? (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <Label className="text-sm font-semibold">Public subscribe URL</Label>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={subscribeUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={() => void copyUrl()}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
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
            <Button onClick={() => void addOne()} disabled={!canEditSettings}>
              <UserPlus className="size-4" />
              Add
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold">Import CSV</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Upload a <code>.csv</code> file or paste rows. Header optional.
            Columns: <code>email,name</code>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            disabled={!canEditSettings || importing}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void onPickCsvFile(file);
            }}
          />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canEditSettings || importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-4" />
              Choose CSV file
            </Button>
            {csvFileName ? (
              <span className="truncate text-xs text-muted-foreground">
                {csvFileName}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                No file selected
              </span>
            )}
          </div>

          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setCsvFileName(null);
            }}
            disabled={!canEditSettings || importing}
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            placeholder={"email,name\nalice@example.com,Alice"}
          />
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void runImport(csv)}
            disabled={!canEditSettings || importing || !csv.trim()}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {importing ? "Importing…" : "Import"}
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
