import { describe, expect, it } from "vitest";

import {
  buildTransactionalEmailHtml,
  maskEmail,
} from "@/lib/email-template";

describe("buildTransactionalEmailHtml", () => {
  it("renders logo, heading, card, CTA, and security block", () => {
    const html = buildTransactionalEmailHtml({
      heading: "Reset your password",
      intro: "Test intro",
      cardTitle: "Password reset",
      details: [{ label: "When", value: "Mon, Jun 30, 2026" }],
      actionUrl: "https://example.com/reset?token=abc",
      actionLabel: "Reset my password",
      securityHeading: "Not you?",
      securityText: "Ignore this email.",
    });

    expect(html).toContain("Reset your password");
    expect(html).toContain("Password reset");
    expect(html).toContain("Reset my password");
    expect(html).toContain("https://example.com/reset?token=abc");
    expect(html).toContain("<img");
    expect(html).toContain("/logo.png");
  });

  it("escapes HTML in dynamic content", () => {
    const html = buildTransactionalEmailHtml({
      heading: "<script>alert(1)</script>",
      intro: "Safe intro",
      cardTitle: "Card",
      details: [{ label: "Account", value: 'a"<b>' }],
      actionUrl: "https://example.com",
      actionLabel: "Go",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("maskEmail", () => {
  it("masks the local part", () => {
    expect(maskEmail("john.doe@example.com")).toBe("jo***@example.com");
  });
});
