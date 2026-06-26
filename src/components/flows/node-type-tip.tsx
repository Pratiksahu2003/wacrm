"use client";

import { Lightbulb } from "lucide-react";
import { NODE_META, NODE_TIPS, type NodeType } from "./shared";

export function NodeTypeTip({ nodeType }: { nodeType: NodeType }) {
  const tip = NODE_TIPS[nodeType];
  const meta = NODE_META[nodeType];
  if (!tip) return null;

  return (
    <div
      className="flex gap-2 rounded-md border border-slate-700/80 bg-slate-800/50 px-3 py-2 text-xs text-slate-300"
      role="note"
    >
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
      <div>
        <span className="font-medium text-slate-200">{meta.label}:</span>{" "}
        {tip}
      </div>
    </div>
  );
}
