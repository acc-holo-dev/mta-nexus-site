import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public build listing scan filter", () => {
  it("requires published and clean state for public build listings", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8",
    );

    const method = repository.indexOf(
      "async listPublishedByProduct(productId: string)",
    );
    const published = repository.indexOf(
      'eq(builds.status, "published")',
      method,
    );
    const clean = repository.indexOf(
      'eq(builds.scanStatus, "clean")',
      published,
    );
    const nextMethod = repository.indexOf("async findById(", method);

    expect(method).toBeGreaterThan(-1);
    expect(published).toBeGreaterThan(method);
    expect(clean).toBeGreaterThan(published);
    expect(clean).toBeLessThan(nextMethod);
  });
});
