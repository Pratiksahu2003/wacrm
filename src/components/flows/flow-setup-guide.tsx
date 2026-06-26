"use client";

/**
 * Step-by-step checklist for turning a draft into an active flow.
 * Collapses automatically once the flow is active and valid.
 */

import { CheckCircle2, Circle, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFlowEditor } from "./flow-editor-state";
import { isTriggerConfigured } from "./trigger-setup-panel";

export function FlowSetupGuide() {
  const {
    state,
    issues,
    canActivate,
    activating,
    setStatus,
    addStarterScaffold,
  } = useFlowEditor();

  const nameDone = state.name.trim().length > 0;
  const triggerDone = isTriggerConfigured(state);
  const hasNodes = state.nodes.length > 0;
  const graphErrors = issues.filter((i) => i.severity === "error");
  const buildDone = hasNodes && graphErrors.length === 0;
  const isActive = state.status === "active";

  if (isActive && canActivate) return null;

  const steps = [
    {
      id: "name",
      label: "Give your flow a name",
      hint: "Use something your team will recognize, e.g. “Welcome menu”.",
      done: nameDone,
    },
    {
      id: "trigger",
      label: "Choose when it starts",
      hint: "Keyword, first message, or manual from inbox.",
      done: triggerDone,
    },
    {
      id: "build",
      label: "Build the conversation",
      hint: "Connect nodes so every path leads somewhere.",
      done: buildDone,
    },
    {
      id: "activate",
      label: "Activate",
      hint: "Turn it on — we save your changes first.",
      done: isActive,
    },
  ];

  const currentStep =
    steps.find((s) => !s.done)?.id ?? (isActive ? null : "activate");

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Setup checklist
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Follow these steps — most people finish in a few minutes.
          </p>
        </div>
        {!hasNodes && (
          <Button
            size="sm"
            variant="outline"
            className="border-primary/40 text-primary"
            onClick={() => addStarterScaffold()}
          >
            Add starter layout
          </Button>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-md px-2 py-1.5 text-sm",
                isCurrent && "bg-slate-900/80",
              )}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isCurrent ? "text-primary" : "text-slate-600",
                  )}
                />
              )}
              <div className="min-w-0">
                <span
                  className={cn(
                    "font-medium",
                    step.done ? "text-slate-300" : "text-white",
                  )}
                >
                  {index + 1}. {step.label}
                </span>
                {isCurrent && (
                  <p className="mt-0.5 text-xs text-slate-400">{step.hint}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {currentStep === "trigger" && (
        <p className="mt-3 text-xs text-slate-400">
          Set keywords or trigger type in the <strong>When should this run?</strong>
          section below.
        </p>
      )}

      {currentStep === "build" && !hasNodes && (
        <p className="mt-3 text-xs text-slate-400">
          Start with the starter layout, or add a <strong>Start</strong> node
          then wire buttons to handoff nodes on the canvas.
        </p>
      )}

      {currentStep === "activate" && canActivate && !isActive && (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-4">
          <Button
            size="sm"
            onClick={() => void setStatus("active")}
            disabled={activating}
          >
            {activating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            Activate flow
          </Button>
          <span className="text-xs text-slate-500">
            Saves your work and turns the flow on.
          </span>
        </div>
      )}

      {currentStep === "activate" && !canActivate && graphErrors.length > 0 && (
        <p className="mt-3 text-xs text-amber-300">
          Fix the {graphErrors.length} issue
          {graphErrors.length === 1 ? "" : "s"} in the panel below before
          activating.
        </p>
      )}
    </div>
  );
}
