/**
 * Feature flags (UX-24/25/26, advertising lifecycle).
 *
 * Advertising-aware surfaces are OFF by default and are surfaced only when
 * explicitly enabled at build time. Nothing in the advertising track is exposed
 * to production visitors or to payments until a separate activation gate.
 */

function envFlag(name: string): boolean {
  const value = process.env[name];
  return value === "1" || value?.toLowerCase() === "true";
}

/** Admin-managed placement lifecycle UI on /admin. */
export const advertisingLifecycleEnabled: boolean = envFlag("NEXT_PUBLIC_ADVERTISING_LIFECYCLE");
