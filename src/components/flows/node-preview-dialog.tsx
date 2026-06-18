"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NODE_META, type BuilderNode } from "./shared";
import { NodePreview } from "./node-preview";
import { cn } from "@/lib/utils";

interface NodePreviewDialogProps {
  node: BuilderNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full-screen WhatsApp-style preview of a single flow node.
 */
export function NodePreviewDialog({
  node,
  open,
  onOpenChange,
}: NodePreviewDialogProps) {
  if (!node) return null;
  const meta = NODE_META[node.node_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "fixed inset-0 top-0 left-0 z-50 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-slate-950 p-0 sm:max-w-none",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-slate-800 px-6 py-4 text-left">
          <DialogTitle className="text-lg text-white">
            Customer preview — {meta.label}
          </DialogTitle>
          <p className="font-mono text-xs text-slate-500">{node.node_key}</p>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <NodePreview node={node} fullscreen />
        </div>
      </DialogContent>
    </Dialog>
  );
}
