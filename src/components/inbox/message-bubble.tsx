"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Message, MessageReaction } from "@/types";
import {
  Clock,
  Check,
  CheckCheck,
  XCircle,
  FileText,
  MapPin,
  LayoutTemplate,
  ImageOff,
  CornerDownLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ReplyQuote } from "./reply-quote";
import { MessageReactions } from "./message-reactions";

interface MessageBubbleProps {
  message: Message;
  /** Pre-computed quote info for messages that reply to another. */
  reply?: { authorLabel: string; preview: string } | null;
  reactions?: MessageReaction[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
  /** Show the WhatsApp-style tail notch (last in a sender group). */
  showTail?: boolean;
  /** Tighter top spacing when grouped with previous message from same sender. */
  isGrouped?: boolean;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "sending":
      return <Clock className="h-[14px] w-[14px] opacity-60" />;
    case "sent":
      return <Check className="h-[14px] w-[14px] opacity-60" />;
    case "delivered":
      return <CheckCheck className="h-[14px] w-[14px] opacity-60" />;
    case "read":
      return <CheckCheck className="wa-status-read h-[14px] w-[14px]" />;
    case "failed":
      return <XCircle className="h-[14px] w-[14px] text-red-400" />;
    default:
      return null;
  }
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-[#8696a0]">
      <ImageOff className="h-4 w-4 shrink-0 opacity-60" />
      <span>{label} unavailable</span>
    </div>
  );
}

function MediaImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadImage = useCallback(async () => {
    if (!url) return;

    if (url.startsWith("/api/whatsapp/media/")) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load media");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setSrc(url);
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadImage();
    return () => {
      if (src?.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadImage]);

  if (error) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-black/20">
        <ImageOff className="h-8 w-8 text-[#8696a0]" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-black/20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />
      </div>
    );
  }

  return (
    <img
      src={src ?? ""}
      alt={alt}
      className="max-h-64 max-w-60 rounded-md object-cover"
      onError={() => setError(true)}
    />
  );
}

function MessageContent({ message }: { message: Message }) {
  switch (message.content_type) {
    case "text":
      return (
        <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
          {message.content_text}
        </p>
      );

    case "image":
      return (
        <div>
          {message.media_url ? (
            <MediaImage url={message.media_url} alt="Shared image" />
          ) : (
            <MediaUnavailable label="Image" />
          )}
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "video":
      return (
        <div>
          {message.media_url ? (
            <video
              src={message.media_url}
              controls
              className="max-h-64 max-w-60 rounded-md"
            />
          ) : (
            <MediaUnavailable label="Video" />
          )}
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "audio":
      return (
        <div>
          {message.media_url ? (
            <audio src={message.media_url} controls className="max-w-60" />
          ) : (
            <MediaUnavailable label="Audio" />
          )}
        </div>
      );

    case "document":
      if (!message.media_url) {
        return <MediaUnavailable label={message.content_text || "Document"} />;
      }
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
        >
          <FileText className="h-5 w-5 shrink-0 text-[#8696a0]" />
          <span className="truncate">
            {message.content_text || "Document"}
          </span>
        </a>
      );

    case "template":
      return (
        <div>
          <span className="mb-1 inline-flex items-center gap-1 rounded bg-[#00a884]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#06cf9c]">
            <LayoutTemplate className="h-3 w-3" />
            Template
          </span>
          {message.content_text && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "location":
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-[#8696a0]" />
          <span>{message.content_text || "Location shared"}</span>
        </div>
      );

    case "interactive":
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[#8696a0]">
            <CornerDownLeft className="h-3 w-3" />
            Button reply
          </span>
          <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
            {message.content_text || "[Interactive reply]"}
          </p>
        </div>
      );

    default:
      return (
        <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
          {message.content_text || "[Unsupported message type]"}
        </p>
      );
  }
}

export function MessageBubble({
  message,
  reply,
  reactions,
  currentUserId,
  onToggleReaction,
  showTail = true,
  isGrouped = false,
}: MessageBubbleProps) {
  const isAgent =
    message.sender_type === "agent" || message.sender_type === "bot";
  const time = format(new Date(message.created_at), "HH:mm");

  return (
    <div
      className={cn(
        "flex flex-col",
        isAgent ? "items-end" : "items-start",
        isGrouped && "-mt-1",
      )}
    >
      <div
        className={cn(
          "relative max-w-full px-[9px] py-[6px] pt-[6px] pb-[8px]",
          isAgent ? "wa-bubble-out" : "wa-bubble-in",
          showTail && "wa-bubble-tail",
          isAgent
            ? cn(
                "rounded-lg",
                showTail ? "rounded-br-none" : "rounded-br-lg",
                isGrouped ? "rounded-tr-none" : "rounded-tr-lg",
              )
            : cn(
                "rounded-lg",
                showTail ? "rounded-bl-none" : "rounded-bl-lg",
                isGrouped ? "rounded-tl-none" : "rounded-tl-lg",
              ),
        )}
      >
        {reply && (
          <ReplyQuote
            authorLabel={reply.authorLabel}
            preview={reply.preview}
            isOutgoing={isAgent}
          />
        )}
        <div className="wa-bubble-content">
          <MessageContent message={message} />
          <span className="wa-bubble-meta">
            {time}
            {isAgent && <StatusIcon status={message.status} />}
          </span>
        </div>
      </div>
      {reactions && reactions.length > 0 && onToggleReaction && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
          isOutgoing={isAgent}
        />
      )}
    </div>
  );
}
