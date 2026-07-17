"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface ReplyQuoteProps {
  authorLabel: string;
  preview: string;
  onDismiss?: () => void;
  isOutgoing?: boolean;
}

export function ReplyQuote({
  authorLabel,
  preview,
  onDismiss,
  isOutgoing = false,
}: ReplyQuoteProps) {
  const isChip = !!onDismiss;
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-l-[3px] border-primary px-2 py-1",
        isChip
          ? "rounded-md bg-muted"
          : cn(
              "mb-1 rounded-md",
              isOutgoing ? "bg-primary/10" : "bg-muted/60",
            ),
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="truncate text-[12px] font-medium text-primary">
          {authorLabel}
        </div>
        <div className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">
          {preview}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cancel reply"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function buildReplyPreview(message: Message): string {
  if (message.content_text) return message.content_text;
  switch (message.content_type) {
    case "image":
      return "[Image]";
    case "video":
      return "[Video]";
    case "audio":
      return "[Audio]";
    case "document":
      return "[Document]";
    case "location":
      return "[Location]";
    case "template":
      return "[Template]";
    default:
      return "[Message]";
  }
}
