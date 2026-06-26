"use client";

/**
 * First-run onboarding for the flow editor. Auto-opens once per
 * browser; users can reopen from the header help button.
 */

import {
  CheckCircle2,
  LayoutGrid,
  MessageSquare,
  PlayCircle,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const ONBOARDING_STORAGE_KEY = "wacrm.flowEditor.onboardingDismissed";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    title: "Flows = WhatsApp conversations",
    description:
      "Customers tap buttons or reply with text. The bot routes them to the right answer or hands off to your team.",
    icon: MessageSquare,
    bullets: [
      "Set a trigger — keyword, first message, or manual from inbox",
      "Build a path with messages, buttons, and handoff nodes",
      "Activate when the checklist shows no errors",
    ],
  },
  {
    title: "Canvas view (recommended)",
    description:
      "See the whole conversation as a diagram. Drag from a node’s right handle to another node to connect paths.",
    icon: LayoutGrid,
    bullets: [
      "Click a node to edit its message or buttons",
      "Green “Entry” badge marks where the flow starts",
      "Use List view for advanced fallback settings",
    ],
  },
  {
    title: "You’re ready to build",
    description:
      "Most flows take a few minutes. Edit the starter text, wire any loose connections, then hit Activate.",
    icon: PlayCircle,
    bullets: [
      "Follow the setup checklist at the top",
      "Fix issues in the panel at the bottom",
      "Activate saves your work and turns the flow on",
    ],
  },
] as const;

export function FlowFirstRunWizard({ open, onOpenChange }: Props) {
  function dismiss() {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : dismiss())}>
      <DialogContent className="sm:max-w-lg bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            How flows work
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            A quick guide — you can reopen this anytime from the help button.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {step.description}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {step.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-1.5 text-xs text-slate-300"
                      >
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500/80" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={dismiss}>Got it — start building</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
  } catch {
    return true;
  }
}
