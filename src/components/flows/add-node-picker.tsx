"use client";

/**
 * Add-node picker — centered dialog with a readable grid instead of a
 * narrow dropdown that overlaps the canvas and header.
 *
 * When `portalRoot` is set (canvas fullscreen), the overlay is rendered
 * inside that element so it stays visible — browser fullscreen only
 * shows descendants of the fullscreen node, so body-portaled dialogs
 * are hidden.
 */

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NODE_META, NODE_TIPS, type NodeType } from "./shared";

export const ADD_NODE_TYPES: NodeType[] = [
  "start",
  "send_buttons",
  "send_list",
  "send_message",
  "send_media",
  "collect_input",
  "condition",
  "set_tag",
  "handoff",
  "end",
];

function AddNodeGrid({ onPick }: { onPick: (type: NodeType) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ADD_NODE_TYPES.map((type) => {
        const meta = NODE_META[type];
        const Icon = meta.icon;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-left transition-colors hover:border-primary/50 hover:bg-slate-800/80"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800"
            >
              <Icon className={cn("h-4 w-4", meta.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{meta.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                {NODE_TIPS[type]}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function InlineAddNodeOverlay({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (type: NodeType) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-node-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="add-node-title" className="text-base font-semibold text-white">
              Add a node
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Pick a step type. You can rename it after adding.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="shrink-0 text-slate-400"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <AddNodeGrid onPick={onPick} />
        </div>
      </div>
    </div>
  );
}

export function AddNodePicker({
  onAdd,
  trigger,
  triggerClassName,
  /** Mount overlay inside this element (required for canvas fullscreen). */
  portalRoot,
}: {
  onAdd: (type: NodeType) => void;
  trigger?: ReactNode;
  triggerClassName?: string;
  portalRoot?: HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);

  const handlePick = (type: NodeType) => {
    onAdd(type);
    setOpen(false);
  };

  const useInlineOverlay = Boolean(portalRoot);

  return (
    <>
      {trigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={triggerClassName}
          aria-label="Add node"
        >
          {trigger}
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn("border-slate-700 bg-slate-900", triggerClassName)}
          aria-label="Add node"
        >
          <Plus className="h-3.5 w-3.5" />
          Add node
        </Button>
      )}

      {open && useInlineOverlay && portalRoot
        ? createPortal(
            <InlineAddNodeOverlay
              onClose={() => setOpen(false)}
              onPick={handlePick}
            />,
            portalRoot,
          )
        : null}

      {!useInlineOverlay && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="flex max-h-[min(85vh,720px)] flex-col gap-0 overflow-hidden border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-2xl"
          >
            <DialogHeader className="border-b border-slate-800 px-5 py-4">
              <DialogTitle>Add a node</DialogTitle>
              <DialogDescription className="text-slate-400">
                Pick a step type. You can rename it after adding.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-5 py-4">
              <AddNodeGrid onPick={handlePick} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
