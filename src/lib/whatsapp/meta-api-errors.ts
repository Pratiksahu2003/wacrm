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
    m.includes('(#131009)')
  ) {
    return 422
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
    m.includes('not configured')
  ) {
    return 400
  }

  return 502
}
