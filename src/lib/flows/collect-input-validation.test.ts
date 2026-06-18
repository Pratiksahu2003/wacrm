import { describe, it, expect } from "vitest";
import { validateCollectedInput } from "./collect-input-validation";

describe("validateCollectedInput", () => {
  it("accepts any non-empty text by default", () => {
    expect(validateCollectedInput("hello", {})).toEqual({ ok: true });
  });

  it("rejects empty text", () => {
    expect(validateCollectedInput("  ", {})).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("validates email", () => {
    expect(
      validateCollectedInput("a@b.co", { validation: "email" }),
    ).toEqual({ ok: true });
    expect(
      validateCollectedInput("not-an-email", { validation: "email" }),
    ).toEqual({ ok: false, reason: "invalid_email" });
  });

  it("validates phone digit length", () => {
    expect(
      validateCollectedInput("+66 83 568 6465", { validation: "phone" }),
    ).toEqual({ ok: true });
    expect(validateCollectedInput("123", { validation: "phone" })).toEqual({
      ok: false,
      reason: "invalid_phone",
    });
  });

  it("validates custom regex", () => {
    expect(
      validateCollectedInput("ABC123", {
        validation: "regex",
        regex: "^[A-Z]{3}\\d{3}$",
      }),
    ).toEqual({ ok: true });
    expect(
      validateCollectedInput("abc123", {
        validation: "regex",
        regex: "^[A-Z]{3}\\d{3}$",
      }),
    ).toEqual({ ok: false, reason: "regex_mismatch" });
  });
});
