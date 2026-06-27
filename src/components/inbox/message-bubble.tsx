"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Message, MessageReaction, MessageTemplate } from "@/types";
import {
  resolveTemplateHeaderDisplay,
  resolveTemplateMessageMediaUrl,
} from "@/lib/whatsapp/header-media-source";
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
  reply?: { authorLabel: string; preview: string } | null;
  reactions?: MessageReaction[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
  showTail?: boolean;
  isGrouped?: boolean;
  /** Local template row — used to render header media/footer for template messages. */
  template?: MessageTemplate | null;
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
    <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2.5 text-xs text-[#8696a0]">
      <ImageOff className="h-4 w-4 shrink-0 opacity-60" />
      <span>{label} unavailable</span>
    </div>
  );
}

function MediaImage({
  url,
  alt,
  variant = "inline",
}: {
  url: string;
  alt: string;
  variant?: "inline" | "template-header";
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const isHeader = variant === "template-header";

  const loadImage = useCallback(async () => {
    if (!url) return;

    if (url.startsWith("/api/whatsapp/media/")) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load media");
        const blob = await res.blob();
        setSrc(URL.createObjectURL(blob));
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

  const frameClass = isHeader
    ? "flex min-h-[140px] w-full items-center justify-center bg-black/20"
    : "flex h-40 w-full max-w-[280px] items-center justify-center rounded-md bg-black/20";

  if (error) {
    return (
      <div className={frameClass}>
        <ImageOff className="h-8 w-8 text-[#8696a0]" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={frameClass}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />
      </div>
    );
  }

  return (
    <img
      src={src ?? ""}
      alt={alt}
      className={cn(
        "object-cover",
        isHeader
          ? "max-h-[280px] w-full"
          : "max-h-64 max-w-[280px] rounded-md",
      )}
      onError={() => setError(true)}
    />
  );
}

function TemplateMessageContent({
  message,
  template,
}: {
  message: Message;
  template?: MessageTemplate | null;
}) {
  const header = useMemo(
    () => (template ? resolveTemplateHeaderDisplay(template) : null),
    [template],
  );
  const mediaUrl = useMemo(
    () => resolveTemplateMessageMediaUrl(message, template),
    [message, template],
  );

  const hasMediaHeader =
    header != null && header.kind !== "text" && Boolean(mediaUrl);
  const headerText =
    header?.kind === "text" ? header.text : undefined;
  const footerText = template?.footer_text?.trim();

  return (
    <div className={cn(hasMediaHeader ? "flex flex-col" : "space-y-1")}>
      {hasMediaHeader && mediaUrl && (
        <div className="overflow-hidden">
          {header?.kind === "image" && (
            <MediaImage
              url={mediaUrl}
              alt="Template header"
              variant="template-header"
            />
          )}
          {header?.kind === "video" && (
            <video
              src={mediaUrl}
              controls
              className="max-h-[280px] w-full bg-black/20 object-cover"
            />
          )}
          {header?.kind === "document" && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border-b border-black/10 bg-black/10 px-3 py-2.5 text-sm hover:bg-black/20"
            >
              <FileText className="h-5 w-5 shrink-0 text-[#8696a0]" />
              <span className="truncate">Document</span>
            </a>
          )}
        </div>
      )}

      <div
        className={cn(
          hasMediaHeader ? "space-y-1 px-3 py-2" : "space-y-1",
        )}
      >
        {!hasMediaHeader && (
          <span className="inline-flex items-center gap-1 rounded bg-[#00a884]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#06cf9c]">
            <LayoutTemplate className="h-3 w-3" />
            Template
          </span>
        )}

        {headerText && (
          <p className="text-[15px] font-medium leading-[20px] text-[#e9edef]">
            {headerText}
          </p>
        )}

        {message.content_text && (
          <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-[#e9edef]">
            {message.content_text}
          </p>
        )}

        {footerText && (
          <p className="pt-0.5 text-[12px] leading-[16px] text-[#8696a0]">
            {footerText}
          </p>
        )}

        {template?.buttons && template.buttons.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-black/10 pt-2">
            {template.buttons.map((btn, i) => (
              <div
                key={`${btn.type}-${i}`}
                className="rounded-md bg-black/10 px-2 py-1.5 text-center text-[13px] text-[#53bdeb]"
              >
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({
  message,
  template,
}: {
  message: Message;
  template?: MessageTemplate | null;
}) {
  switch (message.content_type) {
    case "text":
      return (
        <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
          {message.content_text}
        </p>
      );

    case "image":
      return (
        <div className="space-y-1.5">
          {message.media_url ? (
            <MediaImage url={message.media_url} alt="Shared image" />
          ) : (
            <MediaUnavailable label="Image" />
          )}
          {message.content_text && (
            <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "video":
      return (
        <div className="space-y-1.5">
          {message.media_url ? (
            <video
              src={message.media_url}
              controls
              className="max-h-64 w-full max-w-[280px] rounded-md"
            />
          ) : (
            <MediaUnavailable label="Video" />
          )}
          {message.content_text && (
            <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px]">
              {message.content_text}
            </p>
          )}
        </div>
      );

    case "audio":
      return (
        <div>
          {message.media_url ? (
            <audio src={message.media_url} controls className="max-w-[280px]" />
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
          className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2.5 text-sm hover:bg-black/30"
        >
          <FileText className="h-5 w-5 shrink-0 text-[#8696a0]" />
          <span className="truncate">
            {message.content_text || "Document"}
          </span>
        </a>
      );

    case "template":
      return <TemplateMessageContent message={message} template={template} />;

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

function getTemplateHasMediaHeader(
  message: Message,
  template?: MessageTemplate | null,
): boolean {
  if (message.content_type !== "template") return false;
  const header = template ? resolveTemplateHeaderDisplay(template) : null;
  const mediaUrl = resolveTemplateMessageMediaUrl(message, template);
  return header != null && header.kind !== "text" && Boolean(mediaUrl);
}

export function MessageBubble({
  message,
  reply,
  reactions,
  currentUserId,
  onToggleReaction,
  showTail = true,
  isGrouped = false,
  template,
}: MessageBubbleProps) {
  const isAgent =
    message.sender_type === "agent" || message.sender_type === "bot";
  const time = format(new Date(message.created_at), "HH:mm");
  const templateMediaHeader = getTemplateHasMediaHeader(message, template);

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
          "relative max-w-[min(100%,340px)]",
          templateMediaHeader ? "overflow-hidden p-0" : "px-3 py-1.5 pb-2",
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
          <div className={cn(templateMediaHeader && "px-3 pt-2")}>
            <ReplyQuote
              authorLabel={reply.authorLabel}
              preview={reply.preview}
              isOutgoing={isAgent}
            />
          </div>
        )}
        <div className="wa-bubble-content">
          <MessageContent message={message} template={template} />
          <span
            className={cn(
              "wa-bubble-meta",
              templateMediaHeader && "px-3 pb-1.5",
            )}
          >
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

/** Whether this message should use a wider row cap (template with media). */
export function messageUsesWideBubble(
  message: Message,
  template?: MessageTemplate | null,
): boolean {
  return getTemplateHasMediaHeader(message, template);
}
