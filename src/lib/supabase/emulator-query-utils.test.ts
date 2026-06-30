import { describe, expect, it } from "vitest";

import {
  compileOrFilter,
  compileWhereClause,
  serializeSqlValue,
  toMySqlDatetime,
} from "@/lib/supabase/emulator-query-utils";

describe("toMySqlDatetime", () => {
  it("converts ISO strings to MySQL datetime", () => {
    expect(toMySqlDatetime("2026-06-30T14:00:16.634Z")).toBe(
      "2026-06-30 14:00:16",
    );
  });

  it("leaves non-ISO strings unchanged", () => {
    expect(toMySqlDatetime("hello")).toBe("hello");
    expect(toMySqlDatetime("2026-06-30")).toBe("2026-06-30");
  });
});

describe("serializeSqlValue", () => {
  it("stringifies objects and normalizes ISO datetimes", () => {
    expect(
      serializeSqlValue({
        at: "2026-06-30T14:00:16.634Z",
        n: 1,
      }),
    ).toBe('{"at":"2026-06-30T14:00:16.634Z","n":1}');
    expect(serializeSqlValue("2026-06-30T14:00:16.634Z")).toBe(
      "2026-06-30 14:00:16",
    );
  });
});

describe("compileOrFilter", () => {
  it("builds OR group for ilike filters", () => {
    const { sql, params } = compileOrFilter(
      "name.ilike.%john%,phone.ilike.%john%",
    );
    expect(sql).toBe("(`name` LIKE ? OR `phone` LIKE ?)");
    expect(params).toEqual(["%john%", "%john%"]);
  });
});

describe("compileWhereClause", () => {
  it("combines AND conditions with OR filter", () => {
    const { whereSql, whereParams } = compileWhereClause(
      [{ column: "account_id", operator: "=", value: "acc-1" }],
      "name.ilike.%a%",
    );
    expect(whereSql).toBe("`account_id` = ? AND (`name` LIKE ?)");
    expect(whereParams).toEqual(["acc-1", "%a%"]);
  });
});

describe("EmulatorQueryBuilder.range", () => {
  it("maps inclusive range to limit and offset", async () => {
    const { EmulatorQueryBuilder } = await import(
      "@/lib/supabase/emulator-client"
    );
    const builder = new EmulatorQueryBuilder("contacts");
    builder.range(25, 49);
    expect((builder as any).offsetCount).toBe(25);
    expect((builder as any).limitCount).toBe(25);
  });
});
