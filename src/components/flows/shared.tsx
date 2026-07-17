/**
 * Shared editor primitives used by both the linear-list and canvas
 * views of a flow.
 *
 * What lives here vs in flow-builder.tsx / flow-canvas.tsx:
 *   - Types and metadata that BOTH views need to render a node
 *     consistently (icon, label, color, 1-line summary).
 *   - Editing-only helpers (defaultConfigFor, slugify, uniqueNodeKey,
 *     BuilderState) stay in flow-builder.tsx until the canvas grows
 *     editing affordances — pulled across in the PR that adds them.
 *
 * Why .tsx and not .ts: NODE_META holds lucide icon components, which
 * are typed as React components; importing them from a .ts module
 * works at runtime but trips TypeScript's
 * `verbatimModuleSyntax`-related linting in some setups. Keeping the
 * file .tsx future-proofs it for inline JSX in node-card renderers.
 */

import {
  Flag,
  GitFork,
  Inbox,
  ListChecks,
  ListPlus,
  MessageCircle,
  Paperclip,
  PlayCircle,
  Tag,
  UserPlus,
  Workflow,
} from "lucide-react";

// ============================================================
// Node-type union — single source of truth for every place the UI
// enumerates types (add menu, type pickers, switch statements). Kept
// in lockstep with `FlowNodeType` in src/lib/flows/types.ts (which
// drives the engine's exhaustiveness check); a divergence between the
// two is always a bug.
// ============================================================

export type NodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "send_media"
  | "collect_input"
  | "condition"
  | "set_tag"
  | "handoff"
  | "end";

export interface BuilderNode {
  node_key: string;
  node_type: NodeType;
  config: Record<string, unknown>;
  /** Optional in v1 — defaults to 0 in the DB. Canvas view reads it
   *  to position nodes; list view ignores it. */
  position_x?: number;
  position_y?: number;
}

// ============================================================
// Per-node-type metadata used to render icons + labels everywhere
// the user sees a node summary.
// ============================================================

export const NODE_META: Record<
  NodeType,
  { label: string; icon: typeof Workflow; color: string }
> = {
  start: { label: "Start", icon: PlayCircle, color: "text-primary" },
  send_message: {
    label: "Send message",
    icon: MessageCircle,
    color: "text-sky-400",
  },
  send_buttons: {
    label: "Send buttons",
    icon: ListChecks,
    color: "text-primary",
  },
  send_list: {
    label: "Send list",
    icon: ListPlus,
    color: "text-indigo-400",
  },
  send_media: {
    label: "Send media",
    icon: Paperclip,
    color: "text-cyan-400",
  },
  collect_input: {
    label: "Collect input",
    icon: Inbox,
    color: "text-teal-400",
  },
  condition: {
    label: "If / else",
    icon: GitFork,
    color: "text-fuchsia-400",
  },
  set_tag: {
    label: "Tag contact",
    icon: Tag,
    color: "text-pink-400",
  },
  handoff: {
    label: "Handoff to agent",
    icon: UserPlus,
    color: "text-amber-400",
  },
  end: { label: "End", icon: Flag, color: "text-muted-foreground" },
};

/** Stored in each node's `config` — user-facing label, not sent to WhatsApp. */
export const NODE_DISPLAY_NAME_FIELD = "display_name";

/** Label shown in the UI — custom name if set, otherwise the node type. */
export function getNodeDisplayName(node: BuilderNode): string {
  const custom =
    typeof node.config[NODE_DISPLAY_NAME_FIELD] === "string"
      ? (node.config[NODE_DISPLAY_NAME_FIELD] as string).trim()
      : "";
  if (custom) return custom;
  return NODE_META[node.node_type].label;
}

/** Dropdown label: custom name + type hint for wiring connections. */
export function formatNodeOptionLabel(node: BuilderNode): string {
  const name = getNodeDisplayName(node);
  const typeLabel = NODE_META[node.node_type].label;
  if (name !== typeLabel) {
    return `${name} (${typeLabel})`;
  }
  return `${name} · ${node.node_key}`;
}

/** Short label for validation issues and compact UI. */
export function formatNodeIssueLabel(node: BuilderNode): string {
  const name = getNodeDisplayName(node);
  if (name !== NODE_META[node.node_type].label) return name;
  return node.node_key;
}

/** Short inline guidance shown above each node’s config form. */
export const NODE_TIPS: Record<NodeType, string> = {
  start:
    "Entry point only — wire “Advances to” to the first message customers see after the trigger fires.",
  send_message:
    "Plain text reply. Good for answers, confirmations, or short instructions before the next step.",
  send_buttons:
    "Up to 3 tappable buttons (20 chars each). Each button needs a target node — drag on canvas or pick from the dropdown.",
  send_list:
    "Scrollable menu for more than 3 options (max 10 rows). Great for FAQs and topic pickers.",
  send_media:
    "Send an image, document, or video. Upload a file or paste a URL; add an optional caption.",
  collect_input:
    "Ask a free-text question and save the reply. Use {{vars.key}} in later messages or handoff notes.",
  condition:
    "Branch based on a saved variable, contact field, or tag. Wire both “true” and “false” paths.",
  set_tag:
    "Add or remove a tag on the contact, then continue to the next node. Useful for routing in inbox filters.",
  handoff:
    "Stop the bot and open the chat for your team. The note appears in the inbox — use {{vars.name}} etc.",
  end:
    "Conversation stops here. No further bot messages unless the customer triggers another flow.",
};

// ============================================================
// Pure editing helpers — used by forms in both views.
// ============================================================

/**
 * Coerce an arbitrary string into a stable identifier (node_key,
 * reply_id, etc.). Lowercases, collapses non-alphanumerics into
 * single underscores, and trims leading/trailing underscores. Falls
 * back to `fallback` for inputs that reduce to an empty string.
 */
export function slugify(s: string, fallback: string): string {
  const cleaned = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

// ============================================================
// Summary helpers — short, single-line content previews used in
// collapsed node cards (list view) and node tiles (canvas view).
// Returns null when there's nothing meaningful to show (start/end,
// or a freshly-added node with no fields filled in).
// ============================================================

export function truncate(s: string, max = 80): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

export function summarizeNode(node: BuilderNode): string | null {
  const cfg = node.config;
  switch (node.node_type) {
    case "start":
    case "end":
      return null;
    case "send_message": {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      return text.length > 0 ? truncate(text) : null;
    }
    case "send_buttons": {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      const buttons = Array.isArray(cfg.buttons)
        ? (cfg.buttons as Array<Record<string, unknown>>)
        : [];
      const titles = buttons
        .map((b) => (typeof b.title === "string" ? b.title : ""))
        .filter(Boolean)
        .join(" / ");
      if (text.length > 0) {
        return titles ? `${truncate(text, 40)} · ${truncate(titles, 35)}` : truncate(text);
      }
      return titles || null;
    }
    case "send_list": {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      const sections = Array.isArray(cfg.sections)
        ? (cfg.sections as Array<Record<string, unknown>>)
        : [];
      const rowCount = sections.reduce<number>((sum, s) => {
        const rows = Array.isArray(s.rows) ? s.rows : [];
        return sum + rows.length;
      }, 0);
      if (text.length > 0) {
        return rowCount > 0
          ? `${truncate(text, 50)} · ${rowCount} option${rowCount === 1 ? "" : "s"}`
          : truncate(text);
      }
      return rowCount > 0
        ? `${rowCount} option${rowCount === 1 ? "" : "s"} across ${sections.length} section${sections.length === 1 ? "" : "s"}`
        : null;
    }
    case "send_media": {
      const mediaType =
        typeof cfg.media_type === "string" ? cfg.media_type : "";
      const filename = typeof cfg.filename === "string" ? cfg.filename : "";
      const url = typeof cfg.media_url === "string" ? cfg.media_url : "";
      const caption = typeof cfg.caption === "string" ? cfg.caption : "";
      const label = mediaType
        ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1)
        : "Media";
      if (!url) return `${label} (no file uploaded)`;
      const name = filename || url.split("/").pop() || "file";
      return caption
        ? `${label}: ${truncate(name, 30)} · ${truncate(caption, 40)}`
        : `${label}: ${truncate(name, 60)}`;
    }
    case "collect_input": {
      const prompt = typeof cfg.prompt_text === "string" ? cfg.prompt_text : "";
      const varKey = typeof cfg.var_key === "string" ? cfg.var_key : "";
      if (prompt.length > 0) {
        return varKey ? `${truncate(prompt, 50)} → vars.${varKey}` : truncate(prompt);
      }
      return varKey ? `→ vars.${varKey}` : null;
    }
    case "condition": {
      const subjectKey =
        typeof cfg.subject_key === "string" ? cfg.subject_key : "";
      if (!subjectKey) return null;
      const subject =
        cfg.subject === "tag"
          ? "tag"
          : cfg.subject === "contact_field"
            ? "field"
            : "var";
      const subjectStr =
        subject === "tag" ? `has tag ${truncate(subjectKey, 24)}` : `${subject}.${subjectKey}`;
      const op =
        cfg.operator === "equals"
          ? "=="
          : cfg.operator === "contains"
            ? "contains"
            : cfg.operator === "present"
              ? "exists"
              : cfg.operator === "absent"
                ? "missing"
                : "";
      const value = typeof cfg.value === "string" ? cfg.value : "";
      const valStr =
        (cfg.operator === "equals" || cfg.operator === "contains") && value
          ? ` "${truncate(value, 20)}"`
          : "";
      return subject === "tag" ? subjectStr : `${subjectStr} ${op}${valStr}`;
    }
    case "set_tag": {
      const mode = cfg.mode === "remove" ? "Remove" : "Add";
      const tagId = typeof cfg.tag_id === "string" ? cfg.tag_id : "";
      // No tag name available without an async lookup here; show a
      // short prefix of the UUID so users can disambiguate between
      // multiple set_tag nodes at a glance.
      return tagId ? `${mode} tag ${tagId.slice(0, 8)}…` : `${mode} tag (none picked)`;
    }
    case "handoff": {
      const note = typeof cfg.note === "string" ? cfg.note : "";
      return note.length > 0 ? truncate(note) : null;
    }
  }
}
