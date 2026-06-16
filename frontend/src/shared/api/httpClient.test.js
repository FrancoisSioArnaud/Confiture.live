import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpClient, normalizeApiBaseUrl } from './httpClient';

describe('normalizeApiBaseUrl', () => {
  it.each([
    [undefined, '/api'],
    [null, '/api'],
    ['', '/api'],
    ['   ', '/api'],
    ['/api/', '/api'],
    ['/api', '/api'],
    ['http://localhost:8000/api/', 'http://localhost:8000/api'],
    ['https://confiture.live/api/', 'https://confiture.live/api'],
    ['https://confiture.live', 'https://confiture.live/api'],
    ['https://confiture.live/', 'https://confiture.live/api'],
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeApiBaseUrl(value)).toBe(expected);
  });
});

describe('httpClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses valid JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ jams: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));

    await expect(httpClient('/jams/')).resolves.toEqual({ jams: [] });
  });

  it('throws an explicit HttpError when an HTML response is returned with status 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><html><body>React app</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })));

    await expect(httpClient('/jams/')).rejects.toMatchObject({
      name: 'HttpError',
      message: 'Réponse HTML reçue au lieu de JSON. L’appel API pointe probablement vers le front React au lieu de /api, ou le proxy Nginx /api/ est mal configuré.',
      status: 200,
      payload: {
        status: 200,
        contentType: 'text/html',
        rawBodyPreview: '<!doctype html><html><body>React app</body></html>',
      },
    });
  });

  it('does not expose the raw JSON parser error for HTML responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><html><body>React app</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })));

    await expect(httpClient('/jams/')).rejects.not.toThrow("Unexpected token '<'");
  });

  it('returns null for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(httpClient('/jams/1/')).resolves.toBeNull();
  });

  it('adds the Django CSRF token header for unsafe requests when the cookie exists', async () => {
    document.cookie = 'csrftoken=csrf-token-123; path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpClient('/jams/', { method: 'POST', body: JSON.stringify({ name: 'Jam' }) })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/jams/', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-CSRFToken': 'csrf-token-123',
      }),
    }));
  });

  it('does not add a CSRF token header for safe requests', async () => {
    document.cookie = 'csrftoken=csrf-token-456; path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jams: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpClient('/jams/', { method: 'GET' })).resolves.toEqual({ jams: [] });

    expect(fetchMock).toHaveBeenCalledWith('/api/jams/', expect.objectContaining({
      method: 'GET',
      headers: expect.not.objectContaining({
        'X-CSRFToken': expect.any(String),
      }),
    }));
  });

  it('keeps an explicit CSRF header when one is provided by the caller', async () => {
    document.cookie = 'csrftoken=csrf-token-cookie; path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpClient('/jams/', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jam' }),
      headers: { 'X-CSRFToken': 'csrf-token-explicit' },
    })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/jams/', expect.objectContaining({
      headers: expect.objectContaining({
        'X-CSRFToken': 'csrf-token-explicit',
      }),
    }));
  });
});
