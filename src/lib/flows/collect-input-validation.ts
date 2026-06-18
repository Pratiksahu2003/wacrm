import type { CollectInputNodeConfig } from "./types";

export type CollectInputValidationResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "invalid_email" | "invalid_phone" | "regex_mismatch" };

/**
 * Validate a customer's free-text reply on a collect_input node.
 * `validation` defaults to `any` when omitted.
 */
export function validateCollectedInput(
  value: string,
  cfg: Pick<CollectInputNodeConfig, "validation" | "regex">,
): CollectInputValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const mode = cfg.validation ?? "any";
  if (mode === "any") return { ok: true };

  if (mode === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, reason: "invalid_email" };
    }
    return { ok: true };
  }

  if (mode === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      return { ok: false, reason: "invalid_phone" };
    }
    return { ok: true };
  }

  if (mode === "regex" && cfg.regex?.trim()) {
    try {
      if (!new RegExp(cfg.regex).test(trimmed)) {
        return { ok: false, reason: "regex_mismatch" };
      }
    } catch {
      // Invalid regex in config — don't block the customer at runtime.
      return { ok: true };
    }
    return { ok: true };
  }

  return { ok: true };
}
