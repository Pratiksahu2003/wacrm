"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface ReplyQuoteProps {
  /** Sender label of the quoted message: "You" for our own messages,
   *  contact name for customer-sent messages. Caller resolves this — the
   *  quote component doesn't see the parent Message. */
  authorLabel: string;
  /** Compact text preview. Falls back to a placeholder for media types. */
  preview: string;
  /** Present → renders the composer-chip variant with an X button. Absent →
   *  renders the embedded-in-bubble variant. */
  onDismiss?: () => void;
  /** Bubble the quote sits inside is outgoing (green) vs incoming. */
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
        "flex items-start gap-2 border-l-[3px] px-2 py-1",
        isChip
          ? "rounded-md bg-[#2a3942]"
          : cn(
              "mb-1 rounded-md",
              isOutgoing ? "border-[#06cf9c] bg-black/15" : "border-[#06cf9c] bg-black/20",
            ),
        isChip && "border-[#06cf9c]",
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="truncate text-[12px] font-medium text-[#06cf9c]">
          {authorLabel}
        </div>
        <div className="whitespace-pre-wrap break-words text-[13px] text-[#e9edef]/80">
          {preview}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cancel reply"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#8696a0] hover:bg-[#374248] hover:text-[#e9edef]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Build the one-line preview text shown inside a reply quote. */
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
