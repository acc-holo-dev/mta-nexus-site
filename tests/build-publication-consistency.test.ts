import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("build publication consistency surface", () => {
  it("uses one deterministic latest-published ordering rule", () => {
    const repository = read(
      "packages/db/src/repositories/builds.ts",
    );

    expect(repository).toContain("findLatestPublishedByProduct");
    expect(repository).toContain(
      ".orderBy(desc(builds.createdAt), desc(builds.id))",
    );
    expect(repository).toContain("latestPublished[0].version");
    expect(repository).not.toContain("currentVersion: reviewed.version");
  });

  it("download resolves the latest published build directly", () => {
    const route = read(
      "apps/web/src/app/api/products/[id]/download/route.ts",
    );

    expect(route).toContain(
      "buildRepository.findLatestPublishedByProduct(productId)",
    );
    expect(route).not.toContain(
      "builds.find((build) => build.status === \"published\")",
    );
  });

  it("keeps reject and retirement fallbacks on the same deterministic ordering", () => {
    const repository = read(
      "packages/db/src/repositories/builds.ts",
    );

    const occurrences =
      repository.match(
        /\.orderBy\(desc\(builds\.createdAt\), desc\(builds\.id\)\)/gu,
      ) ?? [];

    expect(occurrences.length).toBeGreaterThanOrEqual(5);
  });
});
