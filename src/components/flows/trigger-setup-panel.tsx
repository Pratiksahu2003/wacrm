"use client";

/**
 * Trigger configuration — shown in the editor shell so both canvas
 * and list views expose "when does this flow run?" without forcing
 * a view switch.
 */

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/lib/flows/validate";
import { IssueLine } from "./validation-panel";
import {
  useFlowEditor,
  type BuilderState,
} from "./flow-editor-state";

const TRIGGER_HINTS: Record<BuilderState["trigger_type"], string> = {
  keyword:
    "Runs when a customer sends a message containing one of your keywords.",
  first_inbound_message:
    "Runs automatically the first time someone messages you on WhatsApp.",
  manual: "Only starts when you manually trigger it from the inbox.",
};

export function isTriggerConfigured(state: BuilderState): boolean {
  if (state.trigger_type === "keyword") {
    const keywords = Array.isArray(state.trigger_config.keywords)
      ? (state.trigger_config.keywords as string[])
      : [];
    return keywords.length > 0;
  }
  return true;
}

export function TriggerSetupPanel({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { state, setState, issues } = useFlowEditor();
  const triggerIssues = issues.filter((i) => i.scope === "trigger");

  return (
    <section
      className={cn(
        "rounded-lg border border-slate-800 bg-slate-900",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className={cn("mb-3", compact && "mb-2")}>
        <h2 className="text-sm font-semibold text-white">When should this run?</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          {TRIGGER_HINTS[state.trigger_type]}
        </p>
      </div>
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2",
        )}
      >
        <div>
          <label className="mb-1 block text-xs text-slate-400">Trigger</label>
          <Select
            value={state.trigger_type}
            onValueChange={(v) =>
              setState((s) => ({
                ...s,
                trigger_type: v as BuilderState["trigger_type"],
                trigger_config:
                  v === "keyword"
                    ? {
                        keywords: ["help", "hi", "support"],
                        match_type: "contains",
                      }
                    : {},
              }))
            }
          >
            <SelectTrigger className="bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keyword">Customer types a keyword</SelectItem>
              <SelectItem value="first_inbound_message">
                First message from a new contact
              </SelectItem>
              <SelectItem value="manual">Manual only (from inbox)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {state.trigger_type === "keyword" && (
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Keywords (comma-separated)
            </label>
            <Input
              value={
                Array.isArray(state.trigger_config.keywords)
                  ? (state.trigger_config.keywords as string[]).join(", ")
                  : ""
              }
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  trigger_config: {
                    ...s.trigger_config,
                    match_type: "contains",
                    keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                }))
              }
              placeholder="help, hi, support"
              className="bg-slate-800"
            />
          </div>
        )}
      </div>
      {triggerIssues.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {triggerIssues.map((i, ix) => (
            <IssueLine key={ix} issue={i} />
          ))}
        </div>
      )}
    </section>
  );
}
