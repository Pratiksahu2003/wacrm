"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PlayCircle, Workflow } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Contact } from "@/types";

interface FlowOption {
  id: string;
  name: string;
  trigger_type: string;
  status: string;
}

interface StartFlowPanelProps {
  contact: Contact;
}

export function StartFlowPanel({ contact }: StartFlowPanelProps) {
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/flows");
        if (!res.ok) throw new Error("Failed to load flows");
        const json = (await res.json()) as { flows?: FlowOption[] };
        const active = (json.flows ?? []).filter((f) => f.status === "active");
        if (!cancelled) {
          setFlows(active);
          setSelectedId((prev) =>
            prev && active.some((f) => f.id === prev) ? prev : (active[0]?.id ?? ""),
          );
        }
      } catch {
        if (!cancelled) setFlows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contact.id]);

  const handleStart = useCallback(async () => {
    if (!selectedId) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/flows/${selectedId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contact.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error("This contact already has an active flow run.");
        return;
      }
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not start flow",
        );
      }
      toast.success("Flow started — the customer should receive the first message shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start flow");
    } finally {
      setStarting(false);
    }
  }, [contact.id, selectedId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading flows…
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <p className="px-1 text-xs text-slate-600">
        No active flows. Activate a flow in Flows to start one here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Select
        value={selectedId}
        onValueChange={(v) => setSelectedId(v ?? "")}
      >
        <SelectTrigger className="h-9 w-full bg-slate-800 text-xs">
          <SelectValue placeholder="Choose a flow" />
        </SelectTrigger>
        <SelectContent>
          {flows.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
              {f.trigger_type === "manual" ? " (manual)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        className="w-full bg-primary hover:bg-primary/90"
        onClick={handleStart}
        disabled={!selectedId || starting}
      >
        {starting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <PlayCircle className="h-3.5 w-3.5" />
        )}
        Start flow
      </Button>
    </div>
  );
}
