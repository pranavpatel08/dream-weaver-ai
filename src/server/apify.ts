// Thin Apify client over fetch. We never bring in @apify/client because:
//   - keeps the bundle tiny
//   - works identically on Node (vite dev) and Cloudflare Workers (future)
//   - the run-sync-get-dataset-items endpoint is one POST and returns all rows.

import { cached, cacheKey, sha256Hex } from "./cache";
import { getEnv } from "./env";

const APIFY_BASE = "https://api.apify.com/v2";

export type ApifyRunOpts = {
  // wall-clock cap for run-sync (Apify's own max is ~5 min)
  timeoutSec?: number;
  // memory in MB (Apify minimum is 128, must be power of 2)
  memoryMb?: number;
  // KV cache TTL; set 0 to bypass cache entirely
  cacheTtlSec?: number;
};

const DEFAULTS: Required<ApifyRunOpts> = {
  timeoutSec: 90,
  memoryMb: 512,
  cacheTtlSec: 60 * 60 * 24, // 24h
};

export class ApifyError extends Error {
  constructor(
    public readonly actorId: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Apify ${actorId} failed: ${status} ${body.slice(0, 200)}`);
    this.name = "ApifyError";
  }
}

/**
 * Runs an Apify actor synchronously and returns dataset rows.
 * `actorId` accepts either the short id (`nFJndFXA5zjCTuudP`) or the
 * URL-safe full name (`apify~google-search-scraper`). We pass it through
 * verbatim — Apify accepts both at this endpoint.
 */
export async function runActorSync<T = unknown>(
  actorId: string,
  input: Record<string, unknown>,
  opts: ApifyRunOpts = {},
): Promise<T[]> {
  const { timeoutSec, memoryMb, cacheTtlSec } = { ...DEFAULTS, ...opts };
  const env = getEnv();
  if (!env.apifyToken) {
    throw new Error("APIFY_TOKEN is not set. Add it to .env.local or your shell.");
  }

  const inputHash = await sha256Hex(JSON.stringify(input));
  const key = cacheKey(["apify", actorId, inputHash]);

  const fetchFn = async (): Promise<T[]> => {
    const url = new URL(
      `${APIFY_BASE}/acts/${encodeURIComponent(actorId).replace("%2F", "~")}/run-sync-get-dataset-items`,
    );
    url.searchParams.set("token", env.apifyToken);
    url.searchParams.set("timeout", String(timeoutSec));
    url.searchParams.set("memory", String(memoryMb));
    url.searchParams.set("clean", "1");

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new ApifyError(actorId, res.status, body);
    }
    return (await res.json()) as T[];
  };

  if (cacheTtlSec <= 0) return fetchFn();
  return cached(key, cacheTtlSec, fetchFn);
}

/** URL-encode an Apify actor's "username/name" form for endpoint paths. */
export function encodeActor(fullName: string): string {
  // Apify accepts `username~name` in URLs; converting at the call-site
  // keeps the rest of the code reading the natural `username/name`.
  return fullName.replace("/", "~");
}
