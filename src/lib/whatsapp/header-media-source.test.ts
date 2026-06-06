import { describe, expect, it } from 'vitest';
import {
  isHttpMediaUrl,
  isWhatsAppCdnUrl,
  normalizeSyncedHeaderMedia,
  pickHeaderMediaLink,
  pickUploadHandle,
} from './header-media-source';

describe('header-media-source', () => {
  it('detects http(s) URLs', () => {
    expect(isHttpMediaUrl('https://example.com/a.png')).toBe(true);
    expect(isHttpMediaUrl('4::aW1hZ2U')).toBe(false);
  });

  it('uses CDN URL stored in header_handle as send link', () => {
    const link = pickHeaderMediaLink({
      header_media_url: undefined,
      header_handle: 'https://scontent.whatsapp.net/v/t61.29466-34/foo.png',
    });
    expect(link).toMatch(/^https:\/\/scontent\.whatsapp\.net/);
  });

  it('prefers header_media_url over header_handle URL', () => {
    expect(
      pickHeaderMediaLink({
        header_media_url: 'https://example.com/a.jpg',
        header_handle: 'https://other.com/b.jpg',
      }),
    ).toBe('https://example.com/a.jpg');
  });

  it('returns upload handle only when not a URL', () => {
    expect(
      pickUploadHandle({ header_handle: '4::abc' }),
    ).toBe('4::abc');
    expect(
      pickUploadHandle({
        header_handle: 'https://scontent.whatsapp.net/x.png',
      }),
    ).toBeUndefined();
  });

  it('normalizes CDN URL from header_handle into header_media_url on sync', () => {
    expect(
      normalizeSyncedHeaderMedia({
        header_handle: 'https://scontent.whatsapp.net/img.png',
        header_url: null,
      }),
    ).toEqual({
      header_handle: null,
      header_media_url: 'https://scontent.whatsapp.net/img.png',
    });
  });

  it('detects WhatsApp CDN URLs', () => {
    expect(
      isWhatsAppCdnUrl('https://scontent.whatsapp.net/v/t61.29466-34/foo'),
    ).toBe(true);
    expect(isWhatsAppCdnUrl('https://example.com/a.jpg')).toBe(false);
  });
});
