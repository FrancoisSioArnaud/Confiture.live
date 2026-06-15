export class HttpError extends Error {
  constructor(message, { status, payload }) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
  }
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

export async function httpClient(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status}`, { status: response.status, payload });
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
