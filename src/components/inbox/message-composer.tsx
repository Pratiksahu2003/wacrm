"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, LayoutTemplate, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanGatedButton } from "@/components/billing/plan-gated-button";
import { useCan } from "@/hooks/use-can";
import { useEntitlements } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";

interface ReplyDraft {
  id: string;
  authorLabel: string;
  preview: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = useCan("send-messages");
  const { canUse, active, configured } = useEntitlements();
  const planAllowsMessaging = !configured || (active && canUse("messaging"));
  const readOnly = !canSend || !planAllowsMessaging;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight],
  );

  const disabled = sessionExpired || readOnly;
  const hasText = text.trim().length > 0;

  return (
    <div className="wa-composer border-t px-3 py-2 sm:px-4">
      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}

      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-700 hover:text-amber-800"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <PlanGatedButton
          variant="ghost"
          size="sm"
          canAct={canSend}
          roleReason="send messages"
          capability="messaging"
          title={readOnly ? undefined : "Send template"}
          className="h-10 w-10 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
          onClick={onOpenTemplates}
        >
          <LayoutTemplate className="h-6 w-6" />
        </PlanGatedButton>

        <div className="wa-input-bar flex min-h-[42px] flex-1 items-end gap-2 px-3 py-2">
          <button
            type="button"
            disabled={disabled}
            aria-label="Emoji"
            className="mb-0.5 shrink-0 text-muted-foreground hover:text-muted-foreground disabled:opacity-40"
          >
            <SmilePlus className="h-6 w-6" />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              !canSend
                ? "Read-only — viewers can browse but not reply"
                : !planAllowsMessaging
                  ? "Subscription required — upgrade to send messages"
                : sessionExpired
                  ? "Session expired — use a template"
                  : "Type a message"
            }
            disabled={disabled}
            rows={1}
            title={
              !canSend
                ? "Read-only — your role can't send messages"
                : !planAllowsMessaging
                  ? "Your plan does not allow messaging — open Billing to upgrade"
                  : undefined
            }
            className={cn(
              "max-h-[100px] min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-[20px] text-foreground placeholder:text-muted-foreground outline-none",
              disabled && "cursor-not-allowed opacity-50",
            )}
          />
        </div>

        <PlanGatedButton
          size="sm"
          canAct={canSend}
          roleReason="send messages"
          capability="messaging"
          disabled={!hasText || sessionExpired || sending}
          onClick={handleSend}
          className={cn(
            "h-[42px] w-[42px] shrink-0 rounded-full p-0 transition-colors disabled:opacity-40",
            hasText
              ? "wa-send-btn hover:bg-primary/90"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Send className="h-5 w-5" />
        </PlanGatedButton>
      </div>
    </div>
  );
}
