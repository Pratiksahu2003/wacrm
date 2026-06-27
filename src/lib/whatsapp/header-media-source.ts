import type { Message, MessageTemplate } from '@/types';

export function isHttpMediaUrl(value?: string | null): boolean {
  if (!value?.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Meta sample assets synced from WhatsApp Manager often use this CDN host. */
export function isWhatsAppCdnUrl(value?: string | null): boolean {
  if (!isHttpMediaUrl(value)) return false;
  try {
    const host = new URL(value!.trim()).hostname.toLowerCase();
    return host === 'scontent.whatsapp.net' || host.endsWith('.whatsapp.net');
  } catch {
    return false;
  }
}

export function isNumericMediaId(value?: string | null): boolean {
  return Boolean(value?.trim() && /^\d+$/.test(value.trim()));
}

export type MediaHeaderType = 'image' | 'video' | 'document';

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

export type TemplateHeaderKind = 'text' | MediaHeaderType;

export interface TemplateHeaderDisplay {
  kind: TemplateHeaderKind;
  text?: string;
  mediaUrl?: string;
}

/**
 * Resolve header assets for in-app template message display.
 * Falls back to the Meta media proxy when only `header_media_id` is stored.
 */
export function resolveTemplateHeaderDisplay(
  template: Pick<
    MessageTemplate,
    | 'header_type'
    | 'header_content'
    | 'header_media_url'
    | 'header_handle'
    | 'header_media_id'
  >,
  options?: { headerText?: string | null; mediaUrlOverride?: string | null },
): TemplateHeaderDisplay | null {
  const headerType = template.header_type;
  if (!headerType) return null;

  if (headerType === 'text') {
    const text =
      options?.headerText?.trim() ||
      template.header_content?.trim() ||
      undefined;
    return text ? { kind: 'text', text } : null;
  }

  const direct =
    options?.mediaUrlOverride?.trim() ||
    pickHeaderMediaLink(template, options?.mediaUrlOverride);
  if (direct) return { kind: headerType, mediaUrl: direct };

  const mediaId = template.header_media_id?.trim();
  if (mediaId) {
    return {
      kind: headerType,
      mediaUrl: `/api/whatsapp/media/${mediaId}`,
    };
  }

  return { kind: headerType };
}

/** Prefer persisted message media, then template definition. */
export function resolveTemplateMessageMediaUrl(
  message: Pick<Message, 'media_url'>,
  template?: Pick<
    MessageTemplate,
    | 'header_type'
    | 'header_content'
    | 'header_media_url'
    | 'header_handle'
    | 'header_media_id'
  > | null,
): string | undefined {
  const fromMessage = message.media_url?.trim();
  if (fromMessage) return fromMessage;
  if (!template) return undefined;
  return resolveTemplateHeaderDisplay(template)?.mediaUrl;
}
