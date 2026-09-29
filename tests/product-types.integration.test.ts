import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { PRODUCT_TYPES } from "@nexus/domain";
import { db } from "../packages/db/src/client";

const migration = readFileSync("packages/db/migrations/0024_product_type_invariant.sql", "utf8");

it("normalizes the legacy alias and enforces types on inserts and updates", async () => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`CREATE TEMP TABLE products (type text NOT NULL, updated_at timestamptz) ON COMMIT DROP`,
    );
    await tx.execute(sql`INSERT INTO products (type) VALUES ('tool')`);
    await tx.execute(sql.raw(migration));
    const rows = await tx.execute(sql`SELECT type FROM products`);
    expect(rows[0].type).toBe("plugin");
    for (const type of PRODUCT_TYPES)
      await tx.execute(sql`INSERT INTO products (type) VALUES (${type})`);
    await expect(
      tx.transaction((savepoint) =>
        savepoint.execute(sql`INSERT INTO products (type) VALUES ('tool')`),
      ),
    ).rejects.toThrow();
    await expect(
      tx.transaction((savepoint) => savepoint.execute(sql`UPDATE products SET type = 'unknown'`)),
    ).rejects.toThrow();
  });
});

it("refuses unknown historical types instead of silently reclassifying them", async () => {
  await expect(
    db.transaction(async (tx) => {
      await tx.execute(
        sql`CREATE TEMP TABLE products (type text NOT NULL, updated_at timestamptz) ON COMMIT DROP`,
      );
      await tx.execute(sql`INSERT INTO products (type) VALUES ('unknown')`);
      await tx.execute(sql.raw(migration));
    }),
  ).rejects.toThrow();
});
