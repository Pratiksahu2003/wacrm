import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  prepareTemplatePayloadForMetaSubmit,
  uploadHeaderMediaForTemplateCreation,
} from './template-header-upload';

vi.mock('./meta-api', () => ({
  getMessageTemplateComponents: vi.fn(),
}));

import { getMessageTemplateComponents } from './meta-api';

describe('uploadHeaderMediaForTemplateCreation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.mocked(getMessageTemplateComponents).mockReset();
  });

  it('runs resumable upload session then file upload', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'upload:abc123' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ h: '4::sampleHandle' }), { status: 200 }),
      );

    const handle = await uploadHeaderMediaForTemplateCreation({
      appId: '123456',
      accessToken: 'token',
      sourceUrl: 'https://example.com/header.jpg',
      headerType: 'image',
    });

    expect(handle).toBe('4::sampleHandle');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/123456/uploads');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('upload:abc123');
  });
});

describe('prepareTemplatePayloadForMetaSubmit', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    vi.mocked(getMessageTemplateComponents).mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reuses existing header_handle when sample URL is unchanged', async () => {
    const result = await prepareTemplatePayloadForMetaSubmit(
      {
        name: 'join',
        category: 'Marketing',
        language: 'en_US',
        header_type: 'image',
        header_media_url: 'https://scontent.whatsapp.net/v/sample.jpg',
        body_text: 'Hello',
      },
      'token',
      {
        existingHeaderHandle: '4::storedHandle',
        existingHeaderMediaUrl: 'https://scontent.whatsapp.net/v/sample.jpg',
        metaTemplateId: '1037318588869138',
      },
    );

    expect(result.header_handle).toBe('4::storedHandle');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getMessageTemplateComponents).not.toHaveBeenCalled();
  });

  it('fetches header_handle from Meta when local row lacks one', async () => {
    vi.mocked(getMessageTemplateComponents).mockResolvedValue([
      {
        type: 'HEADER',
        format: 'IMAGE',
        example: { header_handle: ['4::fromMeta'] },
      },
    ]);

    const result = await prepareTemplatePayloadForMetaSubmit(
      {
        name: 'join',
        category: 'Marketing',
        language: 'en_US',
        header_type: 'image',
        header_media_url: 'https://scontent.whatsapp.net/v/sample.jpg',
        body_text: 'Hello',
      },
      'token',
      {
        existingHeaderMediaUrl: 'https://scontent.whatsapp.net/v/sample.jpg',
        metaTemplateId: '1037318588869138',
      },
    );

    expect(result.header_handle).toBe('4::fromMeta');
    expect(getMessageTemplateComponents).toHaveBeenCalledWith(
      '1037318588869138',
      'token',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uploads when header media URL changed', async () => {
    process.env.META_APP_ID = '123456';
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'upload:abc123' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ h: '4::freshHandle' }), { status: 200 }),
      );

    const result = await prepareTemplatePayloadForMetaSubmit(
      {
        name: 'join',
        category: 'Marketing',
        language: 'en_US',
        header_type: 'image',
        header_media_url: 'https://example.com/new-header.jpg',
        body_text: 'Hello',
      },
      'token',
      {
        existingHeaderHandle: '4::storedHandle',
        existingHeaderMediaUrl: 'https://scontent.whatsapp.net/v/old.jpg',
        metaTemplateId: '1037318588869138',
      },
    );

    expect(result.header_handle).toBe('4::freshHandle');
    expect(getMessageTemplateComponents).not.toHaveBeenCalled();
  });
});
