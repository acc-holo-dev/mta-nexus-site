import { describe, expect, it } from "vitest";
import {
  AD_OPT_IN,
  AD_OPT_OUT,
  AD_OPT_OUT_COOKIE,
  adPreferenceCookie,
  parseAdPreference,
} from "../../apps/web/src/lib/ad-preference";

describe("ad-preference (UX-26 opt-out)", () => {
  it("unknown or missing cookie value resolves to opt-in default", () => {
    expect(parseAdPreference(undefined)).toBe(AD_OPT_IN);
    expect(parseAdPreference(null)).toBe(AD_OPT_IN);
    expect(parseAdPreference("")).toBe(AD_OPT_IN);
    expect(parseAdPreference("anything-else")).toBe(AD_OPT_IN);
  });

  it("resolves only the explicit opt-out value to opt-out", () => {
    expect(parseAdPreference(AD_OPT_OUT)).toBe(AD_OPT_OUT);
    expect(parseAdPreference("out")).toBe(AD_OPT_OUT);
  });

  it("writes the opt-out cookie as a SameSite=Lax non-secure preference in node", () => {
    expect(adPreferenceCookie(AD_OPT_OUT)).toBe(
      `${AD_OPT_OUT_COOKIE}=out; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });

  it("writes the opt-in cookie value", () => {
    expect(adPreferenceCookie(AD_OPT_IN)).toBe(
      `${AD_OPT_OUT_COOKIE}=in; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });
});
