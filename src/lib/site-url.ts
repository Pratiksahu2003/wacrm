/** Configured canonical site URL (`NEXT_PUBLIC_SITE_URL`), without trailing slash. */
export function getConfiguredSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!explicit) return null;
  return explicit.replace(/\/+$/, "");
}

/**
 * Public app origin for auth email links (verification, password reset).
 * Prefers `NEXT_PUBLIC_SITE_URL` so emails always point at production,
 * even when the signup form is opened on localhost or a preview URL.
 */
export function getPublicSiteUrl(): string {
  const configured = getConfiguredSiteUrl();
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Absolute URL for a path on the public app origin. */
export function publicAppUrl(path: string): string {
  const base = getPublicSiteUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
