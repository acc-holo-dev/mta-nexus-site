/**
 * Advertising opt-out preference (UX-26).
 *
 * Cookie-based user preference for whether sponsored placements may be shown.
 * RFC guidance: this is a SameSite=Lax, non-sensitive preference — not a
 * tracking identifier, not a behavioral profile, and it never influences
 * organic score/order, reviews, popularity or trust. OFF by default: no public
 * serve path renders a slot until a separate activation gate enables a
 * renderer with a real serve-route. Storing the preference here only records
 * the user choice; it does not create observed events by itself.
 */
export const AD_OPT_OUT_COOKIE = "nexus_ad_opt_out";
export const AD_OPT_OUT = "out";
export const AD_OPT_IN = "in";

export type AdPreference = "in" | "out";

export function parseAdPreference(value: string | null | undefined): AdPreference {
  return value === AD_OPT_OUT ? "out" : "in";
}

export function adPreferenceCookie(value: AdPreference): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  return `${AD_OPT_OUT_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
