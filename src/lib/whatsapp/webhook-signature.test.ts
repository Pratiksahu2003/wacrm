import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyMetaWebhookSignature } from "./webhook-signature";

const SECRET = process.env.META_APP_SECRET!;

function signedHeader(body: string, secret: string = SECRET): string {
  const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hex}`;
}

describe("verifyMetaWebhookSignature", () => {
  it("accepts a request signed with the correct secret", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    expect(await verifyMetaWebhookSignature(body, signedHeader(body))).toBe(true);
  });

  it("accepts when body is provided as raw bytes", async () => {
    const body = JSON.stringify({ entry: [] });
    const bytes = Buffer.from(body, "utf8");
    expect(await verifyMetaWebhookSignature(bytes, signedHeader(body))).toBe(true);
  });

  it("rejects a signature computed with a different secret", async () => {
    const body = "{}";
    expect(
      await verifyMetaWebhookSignature(body, signedHeader(body, "wrong")),
    ).toBe(
      false,
    );
  });

  it("rejects when the body has been tampered with after signing", async () => {
    const original = '{"entry":[]}';
    const header = signedHeader(original);
    const tampered = '{"entry":[{"id":"injected"}]}';
    expect(await verifyMetaWebhookSignature(tampered, header)).toBe(false);
  });

  it("rejects a missing header", async () => {
    expect(await verifyMetaWebhookSignature("anything", null)).toBe(false);
  });

  it("rejects a header without the sha256= prefix", async () => {
    const body = "{}";
    const hex = crypto
      .createHmac("sha256", SECRET)
      .update(body)
      .digest("hex");
    expect(await verifyMetaWebhookSignature(body, hex)).toBe(false);
    expect(await verifyMetaWebhookSignature(body, `sha512=${hex}`)).toBe(false);
  });

  it("rejects a header of the wrong length without throwing", async () => {
    // timingSafeEqual would throw on length mismatch — the guard inside
    // the verifier should catch this and return false instead.
    expect(await verifyMetaWebhookSignature("{}", "sha256=tooshort")).toBe(false);
  });

  it("accepts when any secret in the list matches", async () => {
    const body = '{"entry":[]}';
    expect(
      await verifyMetaWebhookSignature(body, signedHeader(body, "tenant-a"), [
        "tenant-b",
        "tenant-a",
      ]),
    ).toBe(true);
  });

  describe("fail-closed when secret is missing", () => {
    const originalSecret = process.env.META_APP_SECRET;
    beforeEach(() => {
      delete process.env.META_APP_SECRET;
    });
    afterEach(() => {
      process.env.META_APP_SECRET = originalSecret;
    });

    it("rejects even a correctly-formed signature when no secret is configured", async () => {
      const body = "{}";
      const header = signedHeader(body, originalSecret!);
      expect(await verifyMetaWebhookSignature(body, header)).toBe(false);
      expect(await verifyMetaWebhookSignature(body, header, [])).toBe(false);
    });
  });
});
