import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getConfiguredSiteUrl,
  getPublicSiteUrl,
  publicAppUrl,
} from "./site-url";

describe("site-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getConfiguredSiteUrl strips trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.suganta.com/");
    expect(getConfiguredSiteUrl()).toBe("https://crm.suganta.com");
  });

  it("getPublicSiteUrl prefers configured site URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.suganta.com");
    expect(getPublicSiteUrl()).toBe("https://crm.suganta.com");
  });

  it("publicAppUrl joins base and path", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.suganta.com");
    expect(publicAppUrl("/login")).toBe("https://crm.suganta.com/login");
    expect(publicAppUrl("join/abc")).toBe("https://crm.suganta.com/join/abc");
  });
});
