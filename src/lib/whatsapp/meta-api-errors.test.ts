import { describe, expect, it } from 'vitest'
import { metaApiErrorStatus } from './meta-api-errors'

describe('metaApiErrorStatus', () => {
  it('returns 422 for Meta JSON schema violations', () => {
    expect(
      metaApiErrorStatus(
        "Your request has violated JSON schema constraint 'type' for the JSON field 'template.components.0.parameters.0.image.id'",
      ),
    ).toBe(422)
  })

  it('returns 400 for send-builder validation errors', () => {
    expect(
      metaApiErrorStatus(
        'image header cannot be sent using the template creation handle.',
      ),
    ).toBe(400)
  })

  it('returns 502 for unknown upstream failures', () => {
    expect(metaApiErrorStatus('Service temporarily unavailable')).toBe(502)
  })
})
