import { describe, expect, it } from "vitest";
import {
  MTA_MASTER_FRESH_TTL_MS,
  mtaDirectoryHttpCacheControl,
} from "../apps/web/src/lib/mta-directory-cache";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");
const snapshot = (ageMs: number, isStale = false) => ({
  fetchedAt: new Date(NOW - ageMs).toISOString(),
  isStale,
});

describe("master-list HTTP cache freshness budget", () => {
  it.each([
    [0, "public, max-age=30"],
    [15_000, "public, max-age=30"],
    [30_000, "public, max-age=30"],
    [31_000, "public, max-age=29"],
    [45_000, "public, max-age=15"],
    [59_000, "public, max-age=1"],
    [59_999, "no-store"],
    [60_000, "no-store"],
    [61_000, "no-store"],
  ])("uses only the remaining freshness for an age of %s ms", (age, expected) => {
    expect(mtaDirectoryHttpCacheControl(snapshot(age), NOW)).toBe(expected);
  });

  it("never serves stale, missing, invalid or future master snapshots as cacheable", () => {
    expect(mtaDirectoryHttpCacheControl(snapshot(0, true), NOW)).toBe("no-store");
    expect(mtaDirectoryHttpCacheControl(null, NOW)).toBe("no-store");
    expect(mtaDirectoryHttpCacheControl(undefined, NOW)).toBe("no-store");
    expect(mtaDirectoryHttpCacheControl({ fetchedAt: "garbage", isStale: false }, NOW)).toBe(
      "no-store",
    );
    expect(mtaDirectoryHttpCacheControl(snapshot(-1), NOW)).toBe("no-store");
    expect(mtaDirectoryHttpCacheControl(snapshot(0), Number.NaN)).toBe("no-store");
  });

  it("never adds stale-while-revalidate or extends the original master TTL", () => {
    for (let ageMs = 0; ageMs <= MTA_MASTER_FRESH_TTL_MS; ageMs += 149) {
      const header = mtaDirectoryHttpCacheControl(snapshot(ageMs), NOW);
      expect(header).not.toContain("stale-while-revalidate");
      if (header === "no-store") continue;
      const maxAgeSeconds = Number(header.match(/max-age=(\d+)/u)?.[1]);
      expect(Number.isSafeInteger(maxAgeSeconds)).toBe(true);
      expect(maxAgeSeconds).toBeLessThanOrEqual(30);
      expect(ageMs + maxAgeSeconds * 1_000).toBeLessThanOrEqual(MTA_MASTER_FRESH_TTL_MS);
    }
  });
});
