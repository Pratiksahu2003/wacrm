/**
 * Minimal wired scaffold for new / blank flows.
 *
 * Gives every new author a working welcome-menu shape (start →
 * buttons → handoffs) so they edit content instead of guessing
 * node types and connections from an empty canvas.
 */

import type { FlowTemplateNode } from "./templates";

export const STARTER_ENTRY_NODE_ID = "start";

export const STARTER_KEYWORD_TRIGGER = {
  keywords: ["help", "hi", "support"],
  match_type: "contains" as const,
};

export const STARTER_FLOW_NODES: FlowTemplateNode[] = [
  {
    node_key: "start",
    node_type: "start",
    config: { next_node_key: "welcome" },
  },
  {
    node_key: "welcome",
    node_type: "send_buttons",
    config: {
      text: "Hi! 👋 How can we help you today?",
      footer_text: "Tap a button below to continue.",
      buttons: [
        {
          reply_id: "support",
          title: "Get support",
          next_node_key: "support_handoff",
        },
        {
          reply_id: "sales",
          title: "Talk to sales",
          next_node_key: "sales_handoff",
        },
      ],
    },
  },
  {
    node_key: "support_handoff",
    node_type: "handoff",
    config: {
      note: "Customer asked for support — check recent messages before replying.",
    },
  },
  {
    node_key: "sales_handoff",
    node_type: "handoff",
    config: {
      note: "Customer asked for sales — share pricing or book a demo.",
    },
  },
];
