import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("product restore scan guard", () => {
  it("requires a clean published build before restoring a suspended product", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/products.ts"),
      "utf8",
    );

    const restore = repository.indexOf(
      "async restoreSuspendedWithPublishedBuild(",
    );
    const publishedBuild = repository.indexOf(
      'eq(builds.status, "published")',
      restore,
    );
    const cleanScan = repository.indexOf(
      'eq(builds.scanStatus, "clean")',
      publishedBuild,
    );
    const restoreWrite = repository.indexOf(
      '.set({ status: "published", updatedAt: now })',
      cleanScan,
    );

    expect(restore).toBeGreaterThan(-1);
    expect(publishedBuild).toBeGreaterThan(restore);
    expect(cleanScan).toBeGreaterThan(publishedBuild);
    expect(restoreWrite).toBeGreaterThan(cleanScan);
  });
});
