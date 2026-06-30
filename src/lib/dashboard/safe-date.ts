/** Parse DB / ISO timestamps safely across browsers. */
export function parseDbDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value.trim()) return new Date(Number.NaN);
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T");
  return new Date(normalized);
}

export function isValidDate(value: Date | string): boolean {
  return !Number.isNaN(parseDbDate(value).getTime());
}
