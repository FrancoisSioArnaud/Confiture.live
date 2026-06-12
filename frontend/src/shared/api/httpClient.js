const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

function buildUrl(path) {
  const normalizedBase = API_BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function parseResponseBody(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getErrorMessage(data, status) {
  return data?.detail
    ?? data?.message
    ?? data?.error
    ?? data?.raw
    ?? `Erreur API (${status})`;
}

export async function request(path, options = {}) {
  const { headers: optionHeaders, ...fetchOptions } = options;
  let response;

  try {
    response = await fetch(buildUrl(path), {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(optionHeaders ?? {}),
      },
    });
  } catch (error) {
    error.isNetworkError = true;
    throw error;
  }

  const text = await response.text();
  const data = parseResponseBody(text);

  if (!response.ok) {
    const error = new Error(getErrorMessage(data, response.status));
    error.status = response.status;
    error.data = data;
    error.isNetworkError = false;
    throw error;
  }

  return data;
}
