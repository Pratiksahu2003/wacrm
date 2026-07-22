import { getInternalAppOrigin } from "@/lib/broadcasts/trigger";

/** Public origin for subscribe/unsubscribe links in emails. */
export function getPublicAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  return getInternalAppOrigin();
}

export function buildUnsubscribeUrl(token: string): string {
  return `${getPublicAppOrigin()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function buildSubscribeUrl(slug: string): string {
  return `${getPublicAppOrigin()}/subscribe/${encodeURIComponent(slug)}`;
}
