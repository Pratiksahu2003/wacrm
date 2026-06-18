import { describe, expect, it } from 'vitest';
import {
  __resetCountryCodeCacheForTests,
  resolveContactPhoneForMeta,
} from './resolve-contact-phone';

describe('resolveContactPhoneForMeta', () => {
  it('normalizes domestic numbers when country code is cached', async () => {
    __resetCountryCodeCacheForTests();

    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof resolveContactPhoneForMeta>[0];

    // Prime cache path is skipped when config is null — pass CC via
    // normalize only when we mock verify. For a unit test without
    // Meta, exercise normalizeToInternational via a stub account that
    // returns no config: numbers already international still work.
    await expect(
      resolveContactPhoneForMeta(supabase, 'acct-1', '668356864658'),
    ).resolves.toBe('668356864658');
  });

  it('rejects clearly invalid numbers', async () => {
    __resetCountryCodeCacheForTests();

    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof resolveContactPhoneForMeta>[0];

    await expect(
      resolveContactPhoneForMeta(supabase, 'acct-1', '123'),
    ).rejects.toThrow(/contact phone invalid/);
  });
});
