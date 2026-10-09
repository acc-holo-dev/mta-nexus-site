/**
 * The upstream MTA master snapshot is fresh for one minute. Public HTTP
 * caches must not extend the declared freshness of player counts or status.
 * The origin may serve a stale outage fallback, but intermediaries must not
 * preserve that fallback as a fresh response.
 */
export const MTA_MASTER_FRESH_TTL_MS = 60_000;
const MAX_PUBLIC_HTTP_AGE_MS = 30_000;

export function mtaDirectoryHttpCacheControl(
  snapshot: { fetchedAt: string; isStale: boolean } | null | undefined,
  now = Date.now(),
): string {
  if (!snapshot || snapshot.isStale || !Number.isFinite(now)) return "no-store";

  const fetchedAt = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(fetchedAt) || fetchedAt > now) return "no-store";

  // Round down rather than allowing cached representations to outlive the
  // master's original one-minute freshness deadline by almost a second.
  const remainingMs = Math.min(
    MAX_PUBLIC_HTTP_AGE_MS,
    MTA_MASTER_FRESH_TTL_MS - (now - fetchedAt),
  );
  const maxAge = Math.floor(remainingMs / 1_000);
  return maxAge > 0 ? `public, max-age=${maxAge}` : "no-store";
}
