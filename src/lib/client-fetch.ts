/** CSRF header required by the middleware on all mutating API requests. */
const CSRF_HEADER = "X-SRX-CSRF";
const CSRF_TOKEN = "1";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Fetch wrapper that automatically adds the CSRF header on mutating requests.
 * Use this instead of raw `fetch()` for all client-side API calls.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);

  if (MUTATING_METHODS.has(method) && !headers.has(CSRF_HEADER)) {
    headers.set(CSRF_HEADER, CSRF_TOKEN);
  }

  return fetch(url, { ...init, headers });
}
