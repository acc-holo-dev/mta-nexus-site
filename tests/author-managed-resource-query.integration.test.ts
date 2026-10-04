import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { db } from "../packages/db/src/client";
import { managedProductCondition } from "../packages/db/src/repositories/products";

it("enforces author and organization authority in PostgreSQL, including revocation", async () => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`CREATE TEMP TABLE products (id text, author_id text, organization_id text) ON COMMIT DROP`,
    );
    await tx.execute(sql`CREATE TEMP TABLE organizations (id text, owner_id text) ON COMMIT DROP`);
    await tx.execute(
      sql`CREATE TEMP TABLE organization_members (organization_id text, user_id text, role text, permissions jsonb) ON COMMIT DROP`,
    );
    await tx.execute(sql`INSERT INTO organizations VALUES ('org', 'org-owner')`);
    await tx.execute(
      sql`INSERT INTO products VALUES ('personal', 'author', null), ('team', 'author', 'org'), ('other', 'other', null)`,
    );
    await tx.execute(
      sql`INSERT INTO organization_members VALUES ('org', 'manager', 'member', '["manage_products"]'), ('org', 'reader', 'member', '[]'), ('org', 'org-admin', 'admin', '[]')`,
    );
    const accessible = async (
      id: string,
      role: "developer" | "moderator" | "admin" = "developer",
    ) => {
      const rows = await tx.execute(
        sql`select id from products where ${managedProductCondition({ id, role })} order by id`,
      );
      return rows.map((row) => row.id);
    };
    expect(await accessible("author")).toEqual(["personal"]);
    expect(await accessible("org-owner")).toEqual(["team"]);
    expect(await accessible("manager")).toEqual(["team"]);
    expect(await accessible("org-admin")).toEqual(["team"]);
    expect(await accessible("reader")).toEqual([]);
    expect(await accessible("unrelated", "moderator")).toEqual([]);
    expect(await accessible("unrelated", "admin")).toEqual(["other", "personal", "team"]);
    await tx.execute(
      sql`UPDATE organization_members SET permissions = '[]' WHERE user_id = 'manager'`,
    );
    expect(await accessible("manager")).toEqual([]);
  });
});
