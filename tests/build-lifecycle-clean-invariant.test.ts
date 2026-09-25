import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = readFileSync(
  resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
  "utf8",
);

function methodBody(name: string, nextName: string): string {
  const start = repository.indexOf(name);
  const end = repository.indexOf(nextName, start + name.length);

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  return repository.slice(start, end);
}

describe("build lifecycle clean publication invariant", () => {
  it("treats only clean published builds as existing releases during submission", () => {
    const body = methodBody(
      "async submitForReview(",
      "async moderatePending(",
    );

    expect(body).toContain('eq(builds.status, "published")');
    expect(body).toContain('eq(builds.scanStatus, "clean")');
  });

  it("uses only clean published builds when approving or rejecting moderation", () => {
    const body = methodBody(
      "async moderatePending(",
      "async retireAndRefreshProduct(",
    );

    const cleanPredicates = body.match(
      /eq\(builds\.scanStatus, "clean"\)/g,
    );

    expect(cleanPredicates).toHaveLength(3);
  });

  it("uses only clean published builds as retirement fallbacks", () => {
    const body = methodBody(
      "async retireAndRefreshProduct(",
      "async create(",
    );

    expect(body).toContain('eq(builds.status, "published")');
    expect(body).toContain('eq(builds.scanStatus, "clean")');
  });
});
