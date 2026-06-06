/**
 * Map Meta / send-builder error messages to HTTP status codes.
 * Validation and schema errors → 400/422; true upstream failures → 502.
 */
export function metaApiErrorStatus(message: string): number {
  const m = message.toLowerCase()

  if (
    m.includes('json schema') ||
    m.includes('invalid parameter') ||
    m.includes('parameter value is not valid') ||
    m.includes('(#100)') ||
    m.includes('(#131009)') ||
    m.includes('(#132000)') ||
    m.includes('(#132001)') ||
    m.includes('(#132015)') ||
    m.includes('violat') ||
    m.includes('not valid')
  ) {
    return 422
  }

  if (
    m.includes('already exist') ||
    m.includes('duplicate') ||
    m.includes('name is already')
  ) {
    return 409
  }

  if (
    m.includes('template creation handle') ||
    m.includes('requires a media link') ||
    m.includes('requires a value') ||
    m.includes('variable(s)') ||
    m.includes('header text variable') ||
    m.includes('url button') ||
    m.includes('coupon code') ||
    m.includes('malformed') ||
    m.includes('not configured') ||
    m.includes('sample value') ||
    m.includes('header_media_url') ||
    m.includes('requires either a public')
  ) {
    return 400
  }

  if (m.includes('permission') || m.includes('(#200)')) {
    return 403
  }

  if (m.includes('rate limit') || m.includes('(#4)')) {
    return 429
  }

  return 502
}
