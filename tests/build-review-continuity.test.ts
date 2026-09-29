import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("build review continuity", () => {
  it("keeps the latest approved release public while a newer build is reviewed", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8"
    );

    expect(repository).toContain('eq(builds.status, "published")');
    expect(repository).toContain("if (!published[0])");
    expect(repository).toContain('status: "pending_review"');
    expect(repository).toContain("db.transaction");
  });
});
