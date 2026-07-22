/**
 * CRM capability keys we gate against VedMint plan features / limits.
 * Admin plan catalogs may use slightly different names — see FEATURE_ALIASES.
 */

export type PlanCapability =
  | "messaging"
  | "broadcasts"
  | "automations"
  | "flows"
  | "team"
  | "whatsapp"
  | "templates"
  | "pipelines"
  | "contacts"
  | "ai_credits"
  | "compliance";

export type PlanLimitKey =
  | "max_contacts"
  | "max_team_members"
  | "max_whatsapp_numbers"
  | "max_broadcast_recipients"
  | "max_broadcasts_per_month"
  | "max_automations"
  | "max_active_automations"
  | "max_flows"
  | "max_active_flows"
  | "max_messages_per_day";

/** Client + server snapshot shape for GET /api/billing/entitlements */
export interface EntitlementSnapshot {
  configured: boolean;
  active: boolean;
  status: string;
  planName: string | null;
  planId: number | null;
  /** ISO timestamp when the current period ends / plan expires. */
  expiresAt: string | null;
  /** True when expiresAt is in the past (plan auto-expired). */
  expired: boolean;
  /** True when active but ending within EXPIRING_SOON_DAYS. */
  expiringSoon: boolean;
  /** Whole days left until expiry (0 if expiring today, null if unknown). */
  daysRemaining: number | null;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  usage: Partial<Record<PlanLimitKey, number>>;
}

/** Warn in-app this many days before the plan ends. */
export const EXPIRING_SOON_DAYS = 7;

/** Primary VedMint feature string for check-feature, plus aliases. */
export const FEATURE_ALIASES: Record<PlanCapability, string[]> = {
  messaging: ["messaging", "inbox", "whatsapp_send", "send_messages", "messages"],
  broadcasts: ["broadcasts", "broadcast", "campaigns"],
  automations: ["automations", "automation", "workflows"],
  flows: ["flows", "flow", "chatbots", "chatbot"],
  team: ["team", "team_members", "seats", "members", "users"],
  whatsapp: ["whatsapp", "whatsapp_config", "waba"],
  templates: ["templates", "message_templates", "whatsapp_templates"],
  pipelines: ["pipelines", "pipeline", "deals", "crm"],
  contacts: ["contacts", "contact", "leads"],
  ai_credits: ["ai_credits", "ai", "credits"],
  compliance: [
    "compliance",
    "opt_out",
    "dnd",
    "gdpr",
    "audit_log",
    "do_not_disturb",
  ],
};

export const LIMIT_ALIASES: Record<PlanLimitKey, string[]> = {
  max_contacts: ["max_contacts", "contacts_limit", "contact_limit", "contacts"],
  max_team_members: [
    "max_team_members",
    "max_members",
    "max_seats",
    "team_members",
    "seats",
  ],
  max_whatsapp_numbers: [
    "max_whatsapp_numbers",
    "max_whatsapp",
    "whatsapp_numbers",
    "max_numbers",
    "phone_numbers",
  ],
  max_broadcast_recipients: [
    "max_broadcast_recipients",
    "broadcast_recipients",
    "max_recipients",
  ],
  max_broadcasts_per_month: [
    "max_broadcasts_per_month",
    "max_broadcasts",
    "broadcasts_per_month",
  ],
  max_automations: ["max_automations", "automations_limit"],
  max_active_automations: [
    "max_active_automations",
    "active_automations",
    "automation_limit",
  ],
  max_flows: ["max_flows", "flows_limit"],
  max_active_flows: ["max_active_flows", "active_flows", "flow_limit"],
  max_messages_per_day: [
    "max_messages_per_day",
    "messages_per_day",
    "daily_messages",
  ],
};

/** Nav items that require an active subscription (or a specific capability). */
export const NAV_CAPABILITY: Record<string, PlanCapability | "active"> = {
  "/inbox": "messaging",
  "/contacts": "contacts",
  "/pipelines": "pipelines",
  "/broadcasts": "broadcasts",
  "/automations": "automations",
  "/flows": "flows",
  "/compliance": "compliance",
};

export const CAPABILITY_LABEL: Record<PlanCapability, string> = {
  messaging: "send messages",
  broadcasts: "run broadcasts",
  automations: "use automations",
  flows: "use flows",
  team: "invite team members (Business plan)",
  whatsapp: "configure WhatsApp",
  templates: "manage templates",
  pipelines: "manage pipelines",
  contacts: "manage contacts",
  ai_credits: "use AI credits",
  compliance: "manage compliance & DND",
};

/**
 * Team seats / invites are Business-plan only.
 * Matches plan name or slug containing a whole-word "business"
 * (e.g. "Business", "Business Monthly", slug "business").
 */
export function isBusinessPlan(input: {
  planName?: string | null;
  planSlug?: string | null;
}): boolean {
  const slug = String(input.planSlug || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (slug === "business" || /(^|_)business($|_)/.test(slug)) return true;

  const name = String(input.planName || "")
    .toLowerCase()
    .trim();
  if (!name) return false;
  return /\bbusiness\b/.test(name);
}

export function isGrowthPlan(input: {
  planName?: string | null;
  planSlug?: string | null;
}): boolean {
  const slug = String(input.planSlug || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (slug === "growth" || /(^|_)growth($|_)/.test(slug)) return true;

  const name = String(input.planName || "")
    .toLowerCase()
    .trim();
  if (!name) return false;
  return /\bgrowth\b/.test(name);
}

export function isStarterPlan(input: {
  planName?: string | null;
  planSlug?: string | null;
}): boolean {
  const slug = String(input.planSlug || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (slug === "starter" || /(^|_)starter($|_)/.test(slug)) return true;

  const name = String(input.planName || "")
    .toLowerCase()
    .trim();
  if (!name) return false;
  return /\bstarter\b/.test(name);
}

/**
 * WhatsApp Business numbers allowed by plan tier.
 * - Starter: 1
 * - Growth: 10
 * - Business: unlimited (`null`)
 * - Unknown / no plan: treat as Starter (1)
 */
export function whatsappNumberLimitForPlan(input: {
  planName?: string | null;
  planSlug?: string | null;
}): number | null {
  if (isBusinessPlan(input)) return null;
  if (isGrowthPlan(input)) return 10;
  return 1;
}

export const TEAM_BUSINESS_ONLY_MESSAGE =
  "Team invites are available on the Business plan only. Upgrade to Business to invite teammates.";

export function whatsappNumberLimitMessage(limit: number): string {
  if (limit <= 1) {
    return "Starter allows 1 WhatsApp number. Upgrade to Growth (10) or Business (unlimited) to add more.";
  }
  return `Your plan allows up to ${limit} WhatsApp numbers. Upgrade to Business for unlimited numbers.`;
}


export function resolveFeatureKey(
  capability: PlanCapability,
  availableKeys?: Iterable<string>,
): string {
  const aliases = FEATURE_ALIASES[capability];
  if (!availableKeys) return aliases[0];
  const set = new Set(
    [...availableKeys].map((k) => k.toLowerCase().replace(/\s+/g, "_")),
  );
  for (const alias of aliases) {
    if (set.has(alias.toLowerCase())) return alias;
  }
  return aliases[0];
}

export function pickLimitValue(
  limits: Record<string, unknown> | null | undefined,
  key: PlanLimitKey,
): number | null {
  if (!limits) return null;
  const aliases = LIMIT_ALIASES[key];
  for (const alias of aliases) {
    const raw = limits[alias] ?? limits[alias.toLowerCase()];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) {
      return Number(raw);
    }
  }
  return null;
}

export function featureEnabledInMap(
  features: Record<string, unknown> | string[] | null | undefined,
  capability: PlanCapability,
): boolean | null {
  if (!features) return null;
  const aliases = FEATURE_ALIASES[capability];

  if (Array.isArray(features)) {
    const normalized = features.map((f) =>
      String(f).toLowerCase().replace(/\s+/g, "_"),
    );
    for (const alias of aliases) {
      if (normalized.includes(alias.toLowerCase())) return true;
    }
    // Explicit feature list present but capability missing → deny
    return normalized.length > 0 ? false : null;
  }

  for (const alias of aliases) {
    if (!(alias in features) && !(alias.toLowerCase() in features)) continue;
    const v = features[alias] ?? features[alias.toLowerCase()];
    if (v === false || v === 0 || v === "0" || v === "false") return false;
    if (v === true || v === 1 || v === "1" || v === "true") return true;
    if (typeof v === "number" && v > 0) return true;
  }
  return null;
}
