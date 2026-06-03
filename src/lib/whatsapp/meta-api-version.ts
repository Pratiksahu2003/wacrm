/** Default Graph API version — keep in sync with Meta App Dashboard → WhatsApp → Configuration. */
const DEFAULT_META_API_VERSION = 'v25.0'

/**
 * Meta Graph API version for all WhatsApp Cloud API calls.
 *
 * Override with `META_API_VERSION` (e.g. `v25.0`) when your Meta app
 * pins a different version in the developer dashboard.
 */
export const META_API_VERSION =
  process.env.META_API_VERSION?.trim() || DEFAULT_META_API_VERSION

export const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`
