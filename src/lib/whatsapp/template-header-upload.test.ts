import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { uploadHeaderMediaForTemplateCreation } from './template-header-upload';

describe('uploadHeaderMediaForTemplateCreation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
