import { describe, expect, it } from "vitest";
import { libraryPageBounds } from "../packages/db/src/repositories/library-page-bounds";
import {
  libraryCopy, libraryHref, parseLibraryFilter, parseLibraryPage,
} from "../apps/web/src/lib/library-view";

describe("bounded library routing", () => {
  it("clamps oversized page numbers and page-size requests without changing totals", () => {
    expect(libraryPageBounds(0)).toEqual({
      page: 1, pageSize: 12, totalPages: 1, offset: 0,
    });
    expect(libraryPageBounds(25, 1)).toMatchObject({
      page: 1, pageSize: 12, totalPages: 3, offset: 0,
    });
    expect(libraryPageBounds(25, 2)).toMatchObject({
      page: 2, pageSize: 12, totalPages: 3, offset: 12,
    });
    expect(libraryPageBounds(25, 9999999)).toMatchObject({
      page: 3, pageSize: 12, offset: 24,
    });
    expect(libraryPageBounds(25, 1, 500)).toMatchObject({
      page: 1, pageSize: 24, totalPages: 2,
    });
    expect(libraryPageBounds(25, 1, 0).pageSize).toBe(1);
    expect(libraryPageBounds(25, NaN).page).toBe(1);
    expect(libraryPageBounds(25, Infinity).page).toBe(1);
    expect(() => libraryPageBounds(-1)).toThrow(RangeError);
    expect(() => libraryPageBounds(NaN)).toThrow(RangeError);
  });

  it("rejects unknown, duplicate or noncanonical user query parameters", () => {
    expect(parseLibraryPage("23")).toBe(23);
    expect(parseLibraryPage("1")).toBe(1);
    for (const input of [undefined, ["1", "2"], "0", "-1", "1000000", "01", "1e3", " 1 "]) {
      expect(parseLibraryPage(input)).toBe(1);
    }
    expect(parseLibraryFilter("ready")).toBe("ready");
    expect(parseLibraryFilter("unavailable")).toBe("unavailable");
    for (const input of ["admin", "", ["ready"], undefined]) {
      expect(parseLibraryFilter(input)).toBe("all");
    }
  });

  it("never interpolates arbitrary query values into library links", () => {
    expect(libraryHref("all", 1)).toBe("/workspace/library");
    expect(libraryHref("ready", 1)).toBe("/workspace/library?filter=ready");
    expect(libraryHref("unavailable", 2)).toBe(
      "/workspace/library?filter=unavailable&page=2",
    );
  });

  it.each(["en", "ru"] as const)("has usable locale copy for all rights states in %s", locale => {
    const copy = libraryCopy[locale];
    for (const key of [
      "title", "ready", "unavailable", "unavailableReason",
      "availableReason", "signInRequired", "note",
    ] as const) {
      expect(copy[key].length).toBeGreaterThan(2);
    }
    expect(copy.title).not.toBe(libraryCopy[locale === "ru" ? "en" : "ru"].title);
  });
});
