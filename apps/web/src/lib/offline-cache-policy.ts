export const PUBLIC_OFFLINE_CACHE_HEADER = "X-Nexus-Offline-Cache";
export const PUBLIC_OFFLINE_CACHE_MARKER = "public-readonly-v1";

const ARTICLE_SLUG_PATH = /^\/articles\/[a-z0-9][a-z0-9-]{2,199}$/u;

const EXACT_PUBLIC_READONLY_PATHS = new Set(["/articles", "/copyright", "/privacy", "/terms"]);

export function isOfflineCacheablePublicPath(pathname: string): boolean {
  return EXACT_PUBLIC_READONLY_PATHS.has(pathname) || ARTICLE_SLUG_PATH.test(pathname);
}

export function appendVaryHeader(current: string | null, value: string): string {
  const entries = (current ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
    entries.push(value);
  }
  return entries.join(", ");
}
