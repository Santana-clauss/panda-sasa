/**
 * Fetch with timeout wrapper using AbortController.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Session storage cache getters & setters with 1-hour expiration.
 */
const CACHE_TTL_MS = 3600 * 1000; // 1 hour

export function getSessionCache<T>(key: string): T | null {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function setSessionCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch {
    // Ignore storage errors (quota exceeded or disabled)
  }
}
