import { describe, expect, it } from "vitest";
import { collectLibraryEntries } from "../apps/web/src/lib/user-library";

describe("personal download library", () => {
  it("includes legacy access, hides unrelated permissions, and deduplicates resource claims", () => {
    const earlier = new Date("2026-01-01T00:00:00Z");
    const later = new Date("2026-09-01T00:00:00Z");
    const entries = collectLibraryEntries(
      [
        { resourceId: "script", permission: "product.download", createdAt: earlier },
        { resourceId: "script", permission: "product.download", createdAt: later },
        { resourceId: "private", permission: "product.update", createdAt: later },
      ],
      [
        { productId: "script", createdAt: earlier },
        { productId: "legacy", createdAt: earlier },
      ],
    );

    expect(entries).toEqual([
      { resourceId: "script", createdAt: later },
      { resourceId: "legacy", createdAt: earlier },
    ]);
  });

  it("returns an empty library when neither source grants download access", () => {
    expect(collectLibraryEntries([], [])).toEqual([]);
  });
});
