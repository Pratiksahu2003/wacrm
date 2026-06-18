"use client";

/**
 * WhatsApp-style preview of what the customer sees for a flow node.
 * Used inline and inside the fullscreen preview dialog.
 */

import { ImageIcon, FileText, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_META, type BuilderNode } from "./shared";

const SAMPLE_VARS: Record<string, string> = {
  name: "Alex",
  email: "alex@example.com",
  company: "Acme Co",
  answer: "Sample answer",
};

function previewInterpolate(template: string): string {
  return template.replace(
    /\{\{\s*vars\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_, key: string) => SAMPLE_VARS[key] ?? `{{vars.${key}}}`,
  );
}

export function canPreviewNode(node: BuilderNode): boolean {
  return [
    "send_message",
    "send_buttons",
    "send_list",
    "send_media",
    "collect_input",
  ].includes(node.node_type);
}

interface NodePreviewProps {
  node: BuilderNode;
  /** When true, fills available space (fullscreen dialog). */
  fullscreen?: boolean;
  className?: string;
}

export function NodePreview({ node, fullscreen, className }: NodePreviewProps) {
  const meta = NODE_META[node.node_type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center",
        fullscreen ? "min-h-0 flex-1 justify-center px-4 py-8" : className,
      )}
    >
      {/* Phone frame */}
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-[2rem] border border-slate-700 bg-[#0b141a] shadow-2xl",
          fullscreen ? "max-h-full max-w-md" : "max-w-[280px]",
        )}
      >
        {/* Status bar / chat header */}
        <div className="flex items-center gap-3 border-b border-slate-800 bg-[#1f2c34] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
            B
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Your business</p>
            <p className="text-[10px] text-emerald-400">online</p>
          </div>
        </div>

        {/* Chat wallpaper */}
        <div
          className={cn(
            "flex flex-1 flex-col gap-3 overflow-y-auto bg-[#0b141a] p-4",
            fullscreen ? "min-h-[420px] max-h-[70vh]" : "min-h-[200px]",
          )}
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(16,185,129,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.04) 0%, transparent 50%)",
          }}
        >
          <PreviewContent node={node} />
        </div>
      </div>

      {/* Node meta caption */}
      <div className="mt-4 flex items-center gap-2 text-center text-xs text-slate-400">
        <Icon className={cn("h-3.5 w-3.5", meta.color)} />
        <span>
          {meta.label}
          <span className="mx-1 text-slate-600">·</span>
          <code className="text-slate-500">{node.node_key}</code>
        </span>
      </div>
      {fullscreen && (
        <p className="mt-2 max-w-md text-center text-[11px] text-slate-500">
          Sample variables (name, email, company) are substituted in{" "}
          <code className="text-slate-400">{"{{vars.*}}"}</code> placeholders.
        </p>
      )}
    </div>
  );
}

function PreviewContent({ node }: { node: BuilderNode }) {
  const cfg = node.config;

  switch (node.node_type) {
    case "send_message": {
      const text =
        typeof cfg.text === "string" ? previewInterpolate(cfg.text) : "";
      return <OutboundBubble text={text || "(empty message)"} />;
    }

    case "collect_input": {
      const text =
        typeof cfg.prompt_text === "string"
          ? previewInterpolate(cfg.prompt_text)
          : "";
      return <OutboundBubble text={text || "(empty prompt)"} />;
    }

    case "send_buttons": {
      const text =
        typeof cfg.text === "string" ? previewInterpolate(cfg.text) : "";
      const buttons = Array.isArray(cfg.buttons)
        ? (cfg.buttons as Array<{ title?: string }>)
        : [];
      return (
        <>
          <OutboundBubble text={text || "(empty message)"} />
          <div className="ml-auto flex max-w-[85%] flex-col gap-1">
            {buttons.length === 0 ? (
              <ButtonChip label="(no buttons)" />
            ) : (
              buttons.map((b, i) => (
                <ButtonChip
                  key={i}
                  label={b.title?.trim() || `Button ${i + 1}`}
                />
              ))
            )}
          </div>
        </>
      );
    }

    case "send_list": {
      const text =
        typeof cfg.text === "string" ? previewInterpolate(cfg.text) : "";
      const label =
        typeof cfg.button_label === "string" && cfg.button_label.trim()
          ? cfg.button_label
          : "View options";
      const sections = Array.isArray(cfg.sections)
        ? (cfg.sections as Array<{
            title?: string;
            rows?: Array<{ title?: string; description?: string }>;
          }>)
        : [];
      const rows = sections.flatMap((s) => s.rows ?? []);
      return (
        <>
          <OutboundBubble text={text || "(empty message)"} />
          <div className="ml-auto max-w-[85%]">
            <button
              type="button"
              className="w-full rounded-lg border border-emerald-600/40 bg-[#1f2c34] px-4 py-2.5 text-center text-sm font-medium text-emerald-400"
            >
              ≡ {label}
            </button>
          </div>
          {rows.length > 0 && (
            <div className="ml-auto max-w-[85%] rounded-lg border border-slate-700 bg-[#1f2c34] p-2">
              <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                List preview
              </p>
              {rows.slice(0, 5).map((row, i) => (
                <div
                  key={i}
                  className="border-t border-slate-700/80 px-2 py-2 first:border-t-0"
                >
                  <p className="text-sm text-white">
                    {row.title?.trim() || `Row ${i + 1}`}
                  </p>
                  {row.description?.trim() && (
                    <p className="text-xs text-slate-400">{row.description}</p>
                  )}
                </div>
              ))}
              {rows.length > 5 && (
                <p className="px-2 py-1 text-[10px] text-slate-500">
                  +{rows.length - 5} more rows
                </p>
              )}
            </div>
          )}
        </>
      );
    }

    case "send_media": {
      const mediaType =
        typeof cfg.media_type === "string" ? cfg.media_type : "image";
      const caption =
        typeof cfg.caption === "string"
          ? previewInterpolate(cfg.caption)
          : "";
      const url = typeof cfg.media_url === "string" ? cfg.media_url : "";
      return (
        <div className="ml-auto max-w-[85%] overflow-hidden rounded-lg bg-[#005c4b] shadow-sm">
          {url && mediaType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Media preview"
              className="max-h-48 w-full object-cover"
            />
          ) : (
            <MediaPlaceholder kind={mediaType} hasUrl={!!url} />
          )}
          {caption && (
            <p className="whitespace-pre-wrap px-3 py-2 text-sm text-[#e9edef]">
              {caption}
            </p>
          )}
        </div>
      );
    }

    default:
      return (
        <p className="text-center text-xs text-slate-500">
          No customer-facing preview for this node type.
        </p>
      );
  }
}

function OutboundBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2 shadow-sm">
      <p className="whitespace-pre-wrap text-sm text-[#e9edef]">{text}</p>
      <p className="mt-1 text-right text-[10px] text-emerald-200/60">12:00</p>
    </div>
  );
}

function ButtonChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-emerald-600/30 bg-[#1f2c34] px-3 py-2 text-center text-sm font-medium text-emerald-400"
    >
      {label}
    </button>
  );
}

function MediaPlaceholder({
  kind,
  hasUrl,
}: {
  kind: string;
  hasUrl: boolean;
}) {
  const Icon =
    kind === "video" ? Video : kind === "document" ? FileText : ImageIcon;
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 bg-[#1f2c34] text-slate-400">
      <Icon className="h-8 w-8" />
      <span className="text-xs capitalize">
        {hasUrl ? kind : `No ${kind} uploaded`}
      </span>
    </div>
  );
}
