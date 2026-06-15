export class HttpError extends Error {
  constructor(message, { status, payload }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
  }
}

const DEFAULT_API_BASE_URL = '/api';
const HTML_RESPONSE_MESSAGE = 'Réponse HTML reçue au lieu de JSON. L’appel API pointe probablement vers le front React au lieu de /api, ou le proxy Nginx /api/ est mal configuré.';

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
}

export function normalizeApiBaseUrl(value) {
  if (value === undefined || value === null) {
    return DEFAULT_API_BASE_URL;
  }

  const trimmedValue = String(value).trim();
  if (!trimmedValue) {
    return DEFAULT_API_BASE_URL;
  }

  if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
    const url = new URL(trimmedValue);
    const normalizedUrl = trimTrailingSlashes(url.toString());
    const normalizedPath = trimTrailingSlashes(url.pathname);

    if (!normalizedPath) {
      return `${normalizedUrl}${DEFAULT_API_BASE_URL}`;
    }

    return normalizedUrl;
  }

  return trimTrailingSlashes(trimmedValue) || DEFAULT_API_BASE_URL;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env?.VITE_API_BASE_URL);

function createErrorPayload(response, rawBody) {
  return {
    status: response.status,
    url: response.url,
    contentType: response.headers.get('content-type') ?? '',
    rawBodyPreview: rawBody.slice(0, 500),
  };
}

function parseJsonResponse(response, rawBody) {
  if (response.status === 204 || rawBody.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const lowerBody = rawBody.trimStart().toLowerCase();
    const isHtmlResponse = lowerBody.startsWith('<!doctype') || lowerBody.startsWith('<html');
    const message = isHtmlResponse
      ? HTML_RESPONSE_MESSAGE
      : `Réponse API non JSON invalide pour ${response.url || 'l’URL demandée'}.`;

    throw new HttpError(message, {
      status: response.status,
      payload: {
        ...createErrorPayload(response, rawBody),
        parseError: error.message,
      },
    });
  }
}

export async function httpClient(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const rawBody = await response.text();
  const payload = parseJsonResponse(response, rawBody);

  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status}`, {
      status: response.status,
      payload: {
        ...createErrorPayload(response, rawBody),
        body: payload,
      },
    });
  }

  return payload;
}

export function get(path, options = {}) {
  return httpClient(path, { ...options, method: 'GET' });
}

export function post(path, body, options = {}) {
  return httpClient(path, { ...options, method: 'POST', body: JSON.stringify(body) });
}

export function patch(path, body, options = {}) {
  return httpClient(path, { ...options, method: 'PATCH', body: JSON.stringify(body) });
}

export function del(path, options = {}) {
  return httpClient(path, { ...options, method: 'DELETE' });
}
