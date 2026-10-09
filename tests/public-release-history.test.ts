import { describe, expect, it } from "vitest";
import { releaseHistoryPageBounds, RELEASE_HISTORY_PAGE_SIZE } from "@nexus/domain";
import {
  parseReleaseHistoryPage,
  releaseHistoryHref,
  releaseHistoryCopy,
} from "../apps/web/src/lib/public-release-history";
import {
  parseDownloadBuildSelection,
  resourceDownloadUrl,
  validDownloadBuildId,
} from "../apps/web/src/lib/build-download-selection";

describe("bounded published build archive", () => {
  it("clamps excessive pages and never allows unbounded page sizes", () => {
    expect(RELEASE_HISTORY_PAGE_SIZE).toBe(12);
    expect(releaseHistoryPageBounds(0, 99)).toMatchObject({
      total: 0, page: 1, pageSize: 12, totalPages: 1, offset: 0,
    });
    expect(releaseHistoryPageBounds(25, 1)).toMatchObject({
      page: 1, totalPages: 3, offset: 0,
    });
    expect(releaseHistoryPageBounds(25, 2)).toMatchObject({
      page: 2, totalPages: 3, offset: 12,
    });
    expect(releaseHistoryPageBounds(25, 999999)).toMatchObject({
      page: 3, totalPages: 3, offset: 24,
    });
    for (const invalid of [-1, NaN, Infinity, 1.5, 0]) {
      expect(releaseHistoryPageBounds(25, invalid).page).toBe(1);
    }
    expect(() => releaseHistoryPageBounds(-1)).toThrow(RangeError);
  });

  it("accepts only canonical bounded query pages", () => {
    expect(parseReleaseHistoryPage("22")).toBe(22);
    for (const invalid of [
      undefined, ["1", "2"], "0", "001", "-1", "2e3", "100000", " 1",
    ]) {
      expect(parseReleaseHistoryPage(invalid)).toBe(1);
    }
    expect(releaseHistoryHref("hello world", 1)).toBe("/market/hello%20world/versions");
    expect(releaseHistoryHref("hello world", 2)).toBe("/market/hello%20world/versions?page=2");
  });

  it("maps absent, valid and duplicate build IDs to distinct outcomes", () => {
    expect(parseDownloadBuildSelection(new URLSearchParams())).toEqual({ kind: "latest" });
    expect(parseDownloadBuildSelection(new URLSearchParams("buildId=bld_abc")))
      .toEqual({ kind: "pinned", buildId: "bld_abc" });
    for (const input of [
      "buildId=", "buildId=bld_abc&buildId=bld_abc",
      "buildId=lic_private", "buildId=../path",
      "buildId=bld_%0Aprivate", "buildId=bld_%2Ffile",
    ]) {
      expect(parseDownloadBuildSelection(new URLSearchParams(input))).toEqual({
        kind: "invalid",
      });
    }
  });

  it("never composes a request URL from an invalid build selector", () => {
    expect(validDownloadBuildId("bld_abc")).toBe(true);
    expect(validDownloadBuildId("bld_" + "a".repeat(120))).toBe(true);
    expect(validDownloadBuildId("bld_" + "a".repeat(121))).toBe(false);
    expect(resourceDownloadUrl("product/id", "bld_version"))
      .toBe("/api/products/product%2Fid/download?buildId=bld_version");
    expect(resourceDownloadUrl("product/id")).toBe("/api/products/product%2Fid/download");
    expect(() => resourceDownloadUrl("product", "../../private")).toThrow(RangeError);
  });

  it.each(["en", "ru"] as const)("provides locale-specific safety disclaimers in %s", locale => {
    const copy = releaseHistoryCopy[locale];
    expect(copy.warning.length).toBeGreaterThan(20);
    expect(copy.scan.length).toBeGreaterThan(2);
    expect(copy.checksum).toBe("SHA-256");
    expect(copy.title).not.toBe(releaseHistoryCopy[locale === "en" ? "ru" : "en"].title);
  });
});
