"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { EmailList } from "@/lib/email-marketing/types";

export function EmailListsPanel() {
  const { canEditSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/lists", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load lists");
      setLists(json.data?.lists ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load lists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = async () => {
    if (!canEditSettings) {
      toast.error("Only admins can create lists");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter a list name");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/email/lists", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setName("");
      toast.success("List created");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading lists…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Create list</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Separate from CRM contacts. Import CSV or share a public subscribe
          form.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-2">
            <Label htmlFor="list-name">Name</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditSettings}
              placeholder="Newsletter"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => void onCreate()}
              disabled={!canEditSettings || creating}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Your lists</h2>
        {lists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lists yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {lists.map((list) => (
              <li
                key={list.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/email/lists/${list.id}`}
                    className="font-medium hover:underline"
                  >
                    {list.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {list.subscriber_count} subscribed · /subscribe/
                    {list.public_slug}
                  </p>
                </div>
                <Link
                  href={`/email/lists/${list.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
