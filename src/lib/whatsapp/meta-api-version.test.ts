import { afterEach, describe, expect, it, vi } from 'vitest'

describe('meta-api-version', () => {
  afterEach(() => {
    delete process.env.META_API_VERSION
  })

  it('defaults to v25.0', async () => {
    const mod = await import('./meta-api-version')
    expect(mod.META_API_VERSION).toBe('v25.0')
    expect(mod.META_API_BASE).toBe('https://graph.facebook.com/v25.0')
  })

  it('respects META_API_VERSION env override', async () => {
    process.env.META_API_VERSION = 'v24.0'
    vi.resetModules()
    const mod = await import('./meta-api-version')
    expect(mod.META_API_VERSION).toBe('v24.0')
    expect(mod.META_API_BASE).toBe('https://graph.facebook.com/v24.0')
  })
})
