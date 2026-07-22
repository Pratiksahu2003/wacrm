import { describe, expect, it } from "vitest";

import { applyMergeTags, ensureUnsubscribeFooter } from "@/lib/email-marketing/merge";

describe("email marketing merge tags", () => {
  it("replaces name and email", () => {
    expect(
      applyMergeTags("Hi {{name}} <{{email}}>", {
        name: "Ada",
        email: "ada@example.com",
      }),
    ).toBe("Hi Ada <ada@example.com>");
  });

  it("appends unsubscribe footer when missing", () => {
    const html = ensureUnsubscribeFooter(
      "<p>Hello</p>",
      "https://wa.vedmint.com/unsubscribe?token=abc",
    );
    expect(html).toContain("unsubscribe?token=abc");
    expect(html).toContain("Unsubscribe");
  });
});
