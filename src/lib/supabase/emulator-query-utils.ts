/** Convert ISO-8601 strings to MySQL DATETIME format (UTC). */
export function toMySqlDatetime(value: unknown): unknown {
  if (typeof value !== "string" || !value.includes("T")) {
    return value;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Normalize values bound as MySQL query parameters. */
export function serializeSqlValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(serializeSqlValue);
  }
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  return toMySqlDatetime(val);
}

/** Parse PostgREST-style `.or('col.op.val,col2.op.val2')` into SQL OR group. */
export function compileOrFilter(orFilter: string): {
  sql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const part of orFilter.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const dot = trimmed.indexOf(".");
    const secondDot = trimmed.indexOf(".", dot + 1);
    if (dot === -1 || secondDot === -1) continue;

    const column = trimmed.slice(0, dot);
    const op = trimmed.slice(dot + 1, secondDot);
    const value = trimmed.slice(secondDot + 1);

    const operator =
      op === "ilike" || op === "like"
        ? "LIKE"
        : op === "neq"
          ? "!="
          : "=";

    clauses.push(`\`${column}\` ${operator} ?`);
    params.push(value);
  }

  if (clauses.length === 0) {
    return { sql: "", params: [] };
  }

  return { sql: `(${clauses.join(" OR ")})`, params };
}

export function compileAndConditions(
  conditions: { column: string; operator: string; value: unknown }[],
): { whereSql: string; whereParams: unknown[] } {
  const whereParts: string[] = [];
  const whereParams: unknown[] = [];

  for (const cond of conditions) {
    if (cond.operator === "IS NULL") {
      whereParts.push(`\`${cond.column}\` IS NULL`);
    } else if (cond.operator === "IN") {
      const values = Array.isArray(cond.value) ? cond.value : [];
      if (values.length > 0) {
        const placeholders = values.map(() => "?").join(", ");
        whereParts.push(`\`${cond.column}\` IN (${placeholders})`);
        whereParams.push(...values.map(serializeSqlValue));
      } else {
        whereParts.push("1 = 0");
      }
    } else {
      whereParts.push(`\`${cond.column}\` ${cond.operator} ?`);
      whereParams.push(serializeSqlValue(cond.value));
    }
  }

  return {
    whereSql: whereParts.join(" AND "),
    whereParams,
  };
}

export function compileWhereClause(
  conditions: { column: string; operator: string; value: unknown }[],
  orFilter: string | null,
): { whereSql: string; whereParams: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  const andClause = compileAndConditions(conditions);
  if (andClause.whereSql) {
    parts.push(andClause.whereSql);
    params.push(...andClause.whereParams);
  }

  if (orFilter) {
    const orClause = compileOrFilter(orFilter);
    if (orClause.sql) {
      parts.push(orClause.sql);
      params.push(...orClause.params);
    }
  }

  return {
    whereSql: parts.join(" AND "),
    whereParams: params,
  };
}
