import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("installation key rotation", () => {
  it("atomically revokes an old active key before creating a replacement", () => {
    const repository = readFileSync(
      path.resolve(process.cwd(), "packages/db/src/repositories/servers.ts"),
      "utf8"
    );
    const migration = readFileSync(
      path.resolve(process.cwd(), "packages/db/migrations/0002_silver_nexus.sql"),
      "utf8"
    );

    expect(repository).toContain("replaceActiveInstallation");
    expect(repository).toContain('set({ status: "revoked" })');
    expect(repository).toContain("return db.transaction");
    expect(migration).toContain("server_installations_one_active_per_server_idx");
    expect(migration).toContain("WHERE");
  });
});
