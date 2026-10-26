import { vi } from "vitest";

/** Canonical origin the browser CSRF guard trusts in these handler tests. */
const BROWSER_MUTATION_ORIGIN = "https://nexus.test";

/** Pin the guard's configured origin so handler tests do not depend on CI's localhost URL. */
export function stubBrowserMutationOrigin() {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", BROWSER_MUTATION_ORIGIN);
}

/**
 * Same-origin browser provenance for a mutation the CSRF adapter must allow through.
 * Does not disable the guard: Origin must match NEXT_PUBLIC_APP_URL.
 */
export function browserMutationHeaders(headers: Record<string, string> = {}) {
  return {
    ...headers,
    origin: BROWSER_MUTATION_ORIGIN,
    "sec-fetch-site": "same-origin",
  };
}
