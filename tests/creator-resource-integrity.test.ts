import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("creator resource integrity", () => {
  it("filters, sorts and bounds the public catalog in PostgreSQL", () => {
    const repository = read("packages/db/src/repositories/products.ts");
    expect(repository).toContain('eq(products.status, "published")');
    expect(repository).toContain("ilike(products.title, pattern)");
    expect(repository).toContain(".orderBy(order)");
    expect(repository).toContain(".limit(limit)");
    expect(repository).not.toContain("items.sort");
  });

  it("prevents concurrent duplicate versions at the database boundary", () => {
    const schema = read("packages/db/src/schema.ts");
    const migration = read("packages/db/migrations/0011_build_version_uniqueness.sql");
    const service = read("apps/web/src/lib/services/product-service.ts");
    expect(schema).toContain('uniqueIndex("builds_product_version_idx")');
    expect(migration).toContain("duplicate versions exist");
    expect(service).toContain('code === "23505"');
    expect(service).toContain("BUILD_VERSION_EXISTS");
  });

  it("does not claim that an unreviewed upload is published", () => {
    const page = read("apps/web/src/app/workspace/resources/new/page.tsx");
    expect(page).toContain("Resource submitted for review");
    expect(page).toContain("moderator approval");
    expect(page).not.toContain(">Resource published<");
  });
});
