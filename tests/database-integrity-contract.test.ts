import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("database integrity contract", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "packages/db/src/schema.ts"),
    "utf8"
  );
  const migration = readFileSync(
    resolve(process.cwd(), "packages/db/migrations/0012_core_integrity_constraints.sql"),
    "utf8"
  );

  it("constrains closed-beta state and range values in schema and SQL", () => {
    for (const constraint of [
      "users_role_check",
      "servers_player_counts_check",
      "server_observations_player_counts_check",
      "products_status_check",
      "products_rating_check",
      "builds_status_check",
      "builds_scan_status_check",
      "content_status_check",
      "comments_rating_target_check",
      "comments_parent_content_fk",
      "entitlements_subject_type_check",
    ]) {
      expect(schema).toContain(constraint);
      expect(migration).toContain(constraint);
    }
  });

  it("prevents duplicate perpetual grants at the database boundary", () => {
    expect(schema).toContain("entitlements_perpetual_grant_idx");
    expect(schema).toContain("expiresAt} is null");
    expect(migration).toContain("duplicate grants exist");
    expect(migration).toContain('WHERE "expires_at" IS NULL');
  });

  it("keeps replies attached to the same content item as their parent", () => {
    expect(schema).toContain("comments_id_content_idx");
    expect(schema).toContain("columns: [table.parentId, table.contentId]");
    expect(migration).toContain('CREATE UNIQUE INDEX "comments_id_content_idx"');
    expect(migration).toContain('FOREIGN KEY ("parent_id", "content_id")');
    expect(migration).toContain('REFERENCES "comments"("id", "content_id")');
  });
});
