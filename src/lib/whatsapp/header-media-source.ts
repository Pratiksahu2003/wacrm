import type { MessageTemplate } from '@/types';

/** True when the value is an http(s) URL (Meta sometimes puts CDN URLs in header_handle). */
export function isHttpMediaUrl(value?: string | null): boolean {
  if (!value?.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolve the public link to use for an IMAGE/VIDEO/DOCUMENT header at send time.
 * Meta sync may store sample media in `header_media_url`, `header_handle` (CDN URL),
 * or only a Resumable Upload handle (handled separately).
 */
export function pickHeaderMediaLink(
  template: Pick<MessageTemplate, 'header_media_url' | 'header_handle'>,
  override?: string | null,
): string | undefined {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;

  const fromStoredUrl = template.header_media_url?.trim();
  if (fromStoredUrl) return fromStoredUrl;

  const handle = template.header_handle?.trim();
  if (handle && isHttpMediaUrl(handle)) return handle;

  return undefined;
}

/** Resumable Upload handle (e.g. `4::aW…`) — not an http URL. */
export function pickUploadHandle(
  template: Pick<MessageTemplate, 'header_handle'>,
): string | undefined {
  const handle = template.header_handle?.trim();
  if (!handle || isHttpMediaUrl(handle)) return undefined;
  return handle;
}

/**
 * Normalize Meta sync fields: CDN/sample URLs belong in header_media_url,
 * not header_handle (which is for Resumable Upload handles only).
 */
export function normalizeSyncedHeaderMedia(args: {
  header_handle?: string | null;
  header_url?: string | null;
}): { header_handle: string | null; header_media_url: string | null } {
  const rawHandle = args.header_handle?.trim() || null;
  const rawUrl = args.header_url?.trim() || null;

  if (rawHandle && isHttpMediaUrl(rawHandle)) {
    return {
      header_handle: null,
      header_media_url: rawUrl ?? rawHandle,
    };
  }

  return {
    header_handle: rawHandle,
    header_media_url: rawUrl,
  };
}
