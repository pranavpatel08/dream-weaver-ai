// In-memory cache with TTL. Keyed by (actorId, sha256(input)) for Apify wrapping.
// In a single-process Vite dev server this is all we need; on multi-instance
// deployment swap to KV without changing the call sites.

type Entry<T> = { value: T; expiresAt: number };

const STORE = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const existing = STORE.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (existing && existing.expiresAt > now) return existing.value;
  const value = await fn();
  STORE.set(key, { value, expiresAt: now + ttlSec * 1000 });
  return value;
}

export function cacheKey(parts: (string | number)[]): string {
  return parts.join(":");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
