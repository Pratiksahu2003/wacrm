/**
 * Build the Meta `components` array used by POST /{phone_number_id}/messages
 * when sending an APPROVED template.
 *
 * Distinct from `template-components.ts` — that module builds the
 * `components` for TEMPLATE CREATION (where you describe headers,
 * footers, buttons, examples). This module builds the per-send
 * `components` (where you fill in variable values and supply the
 * actual media link or button URL suffix for THIS specific delivery).
 *
 * Auto-fills as much as possible from the template row so callers
 * only need to supply values for the variable-bearing fields:
 *
 *   - Static IMAGE/VIDEO/DOCUMENT headers use `header_media_url` or a
 *     numeric media id when overriding at send time. Templates approved
 *     on Meta (meta_template_id / header_handle from sync) embed the
 *     media in the template — no send-time header component needed.
 *   - TEXT headers with `{{1}}` need `headerText` from the caller.
 *   - Body variables come in as `body: string[]`, indexed by {{N}}.
 *   - URL buttons with `{{1}}` need `buttonUrlParams[i]` keyed by
 *     button index. URL buttons without variables, plus QUICK_REPLY
 *     and PHONE_NUMBER buttons, don't need send-time parameters.
 *   - COPY_CODE buttons need the actual code to display. We fall
 *     back to the template's `example` value if the caller doesn't
 *     override — that matches the most common use case (a static
 *     promo code) without forcing UI work.
 *
 * Validation throws here (not at the Meta API boundary) so a missing
 * sample surfaces as "Header text variable {{1}} requires a value",
 * not a 400 from Meta that doesn't say which field broke.
 */

import type { MessageTemplate, TemplateButton } from '@/types';
import { extractVariableIndices } from './template-validators';

export interface SendTimeParams {
  /** Values for body {{1}}, {{2}}, … indexed by variable position. */
  body?: string[];
  /** Value for TEXT-header {{1}}, when the header has a variable. */
  headerText?: string;
  /** Override the template's static media URL for this send. */
  headerMediaUrl?: string;
  /** Alternative: send the media by Meta media id (from prior upload). */
  headerMediaId?: string;
  /**
   * Per-button overrides keyed by the button's index in the
   * template's `buttons` array. Used for URL buttons with a {{1}}
   * suffix and for COPY_CODE buttons whose example you want to
   * override at send time.
   */
  buttonParams?: Record<number, string>;
}

export type MetaSendComponent =
  | { type: 'header'; parameters: MetaSendParameter[] }
  | { type: 'body'; parameters: MetaSendParameter[] }
  | {
      type: 'button';
      sub_type: 'url' | 'quick_reply' | 'copy_code';
      index: string;
      parameters: MetaSendParameter[];
    };

type MediaSendPayload = { link: string } | { id: number };

type MetaSendParameter =
  | { type: 'text'; text: string }
  | { type: 'image'; image: MediaSendPayload }
  | { type: 'video'; video: MediaSendPayload }
  | { type: 'document'; document: MediaSendPayload }
  | { type: 'coupon_code'; coupon_code: string }
  | { type: 'payload'; payload: string };

/** Resumable-upload handles (4::…) are for template creation only. */
function isTemplateCreationHandle(value: string): boolean {
  return value.includes('::');
}

function isNumericMediaId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/**
 * Resolve send-time media for IMAGE/VIDEO/DOCUMENT headers.
 * Prefers public HTTPS link; falls back to numeric Cloud API media id.
 */
export function resolveMediaSendPayload(
  link?: string | null,
  mediaId?: string | null,
  headerType = 'media',
): MediaSendPayload {
  const trimmedLink = link?.trim();
  if (trimmedLink) {
    return { link: trimmedLink };
  }

  const trimmedId = mediaId?.trim();
  if (trimmedId && isNumericMediaId(trimmedId)) {
    return { id: parseInt(trimmedId, 10) };
  }

  if (trimmedId && isTemplateCreationHandle(trimmedId)) {
    throw new Error(
      `${headerType} header cannot use a template creation handle as send media id. ` +
        'Use headerMediaUrl with a public HTTPS URL or a numeric media id from POST /media.',
    );
  }

  if (trimmedId) {
    throw new Error(
      `${headerType} header media id must be numeric. Got a non-numeric value — use headerMediaUrl with a public HTTPS URL instead.`,
    );
  }

  throw new Error(
    `${headerType} header requires a media link or numeric media id at send time — ` +
      'set header_media_url on the template or pass headerMediaUrl/headerMediaId.',
  );
}

function buildHeaderComponent(
  template: MessageTemplate,
  params: SendTimeParams,
): MetaSendComponent | null {
  const headerType = template.header_type;
  if (!headerType) return null;

  if (headerType === 'text') {
    // TEXT header with {{1}} → need a value. Static text headers
    // (no variables) just ride along inside the template itself; no
    // header component required on send.
    const varCount = extractVariableIndices(template.header_content ?? '').length;
    if (varCount === 0) return null;
    const value = params.headerText ?? template.sample_values?.header?.[0];
    if (!value || !value.trim()) {
      throw new Error(
        'Header text variable {{1}} requires a value — pass headerText.',
      );
    }
    return {
      type: 'header',
      parameters: [{ type: 'text', text: value }],
    };
  }

  // image / video / document
  const link = params.headerMediaUrl ?? template.header_media_url;
  const mediaId = params.headerMediaId;

  if (!link?.trim() && !mediaId?.trim()) {
    // Media uploaded during Meta template approval is stored on Meta's
    // side. Omit the header component — same as static TEXT headers.
    if (template.meta_template_id) {
      return null;
    }
    throw new Error(
      `${headerType} header requires a media link or numeric media id at send time — ` +
        'set header_media_url on the template, pass headerMediaUrl at send time, or submit the template to Meta first.',
    );
  }

  const mediaPayload = resolveMediaSendPayload(link, mediaId, headerType);
  return {
    type: 'header',
    parameters: [
      headerType === 'image'
        ? { type: 'image', image: mediaPayload }
        : headerType === 'video'
          ? { type: 'video', video: mediaPayload }
          : { type: 'document', document: mediaPayload },
    ],
  };
}

function buildBodyComponent(
  template: MessageTemplate,
  params: SendTimeParams,
): MetaSendComponent | null {
  const varCount = extractVariableIndices(template.body_text).length;
  const body = params.body ?? [];
  if (varCount === 0 && body.length === 0) return null;
  if (body.length < varCount) {
    throw new Error(
      `Body has ${varCount} variable(s) but only ${body.length} value(s) were supplied.`,
    );
  }
  // Trim to the variable count — extra values are dropped silently so
  // a legacy caller that passes too many doesn't error out.
  const values = body.slice(0, varCount);
  return {
    type: 'body',
    parameters: values.map((text) => ({ type: 'text', text: String(text) })),
  };
}

function buttonNeedsSendParam(
  button: TemplateButton,
  override: string | undefined,
): boolean {
  switch (button.type) {
    case 'URL':
      return extractVariableIndices(button.url).length > 0;
    case 'COPY_CODE':
      // We always emit a button param for COPY_CODE so the customer
      // gets a real code (either the caller's override or the
      // template's example as a default).
      return true;
    case 'QUICK_REPLY':
    case 'PHONE_NUMBER':
      return override !== undefined;
  }
}

function buildButtonComponent(
  button: TemplateButton,
  index: number,
  override: string | undefined,
): MetaSendComponent | null {
  if (!buttonNeedsSendParam(button, override)) return null;

  switch (button.type) {
    case 'URL': {
      // Each URL button is its own component with sub_type=url and
      // the button's index in the template's buttons array.
      const urlValue = override?.trim() || button.example?.trim();
      if (!urlValue) {
        throw new Error(
          `URL button #${index + 1} uses {{1}} — requires a buttonParams[${index}] value.`,
        );
      }
      return {
        type: 'button',
        sub_type: 'url',
        index: String(index),
        parameters: [{ type: 'text', text: urlValue }],
      };
    }
    case 'COPY_CODE': {
      const code = override?.trim() || button.example?.trim();
      if (!code) {
        throw new Error(
          `COPY_CODE button #${index + 1} requires a coupon code. Provide buttonParams[${index}] or add an example code in the template definition.`,
        );
      }
      return {
        type: 'button',
        sub_type: 'copy_code',
        index: String(index),
        parameters: [{ type: 'coupon_code', coupon_code: code }],
      };
    }
    case 'QUICK_REPLY': {
      // Only included when the caller explicitly overrides the
      // payload (rare — usually QR buttons use their default text).
      return {
        type: 'button',
        sub_type: 'quick_reply',
        index: String(index),
        parameters: [{ type: 'payload', payload: override! }],
      };
    }
    case 'PHONE_NUMBER':
      // PHONE_NUMBER buttons never accept send-time params per Meta —
      // return null even if an override snuck through.
      return null;
  }
}

/**
 * Build the full `components` array for the send-message payload.
 * Returns an empty array when the template is fully static (no
 * variables, no media header), which is a valid Meta request.
 */
export function buildSendComponents(
  template: MessageTemplate,
  params: SendTimeParams = {},
): MetaSendComponent[] {
  const out: MetaSendComponent[] = [];
  const header = buildHeaderComponent(template, params);
  if (header) out.push(header);
  const body = buildBodyComponent(template, params);
  if (body) out.push(body);
  if (template.buttons?.length) {
    template.buttons.forEach((btn, i) => {
      const override = params.buttonParams?.[i];
      const component = buildButtonComponent(btn, i, override);
      if (component) out.push(component);
    });
  }
  return out;
}
