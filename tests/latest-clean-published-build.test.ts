import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("latest downloadable build resolver", () => {
  it("requires clean scan state in addition to published status", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8",
    );

    const method = repository.indexOf(
      "async findLatestPublishedByProduct(productId: string)",
    );
    const published = repository.indexOf(
      'eq(builds.status, "published")',
      method,
    );
    const clean = repository.indexOf(
      'eq(builds.scanStatus, "clean")',
      published,
    );
    const order = repository.indexOf(
      ".orderBy(desc(builds.createdAt), desc(builds.id))",
      clean,
    );

    expect(method).toBeGreaterThan(-1);
    expect(published).toBeGreaterThan(method);
    expect(clean).toBeGreaterThan(published);
    expect(order).toBeGreaterThan(clean);
  });
});
