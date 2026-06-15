const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

export async function httpJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers ?? {}) }, ...options });
  } catch (error) {
    error.status = 0;
    throw error;
  }
  if (!response.ok) {
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    const message = payload?.detail || payload?.error || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
