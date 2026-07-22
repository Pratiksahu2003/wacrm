import { describe, expect, it } from "vitest";

import { matchComplianceKeyword } from "@/lib/compliance";

describe("matchComplianceKeyword", () => {
  it("matches STOP exactly case-insensitive", () => {
    expect(matchComplianceKeyword("stop", ["STOP", "UNSUBSCRIBE"])).toBe(
      "STOP",
    );
    expect(matchComplianceKeyword("  STOP  ", ["STOP"])).toBe("STOP");
  });

  it("does not match partial contains", () => {
    expect(
      matchComplianceKeyword("please stop messaging me", ["STOP"]),
    ).toBeNull();
  });

  it("matches START for opt-in", () => {
    expect(matchComplianceKeyword("start", ["START", "YES"])).toBe("START");
  });
});
