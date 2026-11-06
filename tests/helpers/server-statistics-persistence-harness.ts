import { sql } from "drizzle-orm";
import { vi } from "vitest";

const active = vi.hoisted(() => ({ db: null as unknown }));

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerStatisticsPersistenceDbMock(importOriginal: <T>() => Promise<T>) {
  const original = await importOriginal<typeof import("../../packages/db/src/client")>();
  return {
    ...original,
    db: new Proxy(original.db, {
      get(target, key) {
        const database = (active.db ?? target) as typeof target;
        const value = Reflect.get(database, key);
        return typeof value === "function" ? value.bind(database) : value;
      },
    }),
  };
}

/** Temporary-table fixture isolating statistics reads from application data. */
export async function fixture(
  run: (tx: typeof import("../../packages/db/src/client").db, end: Date) => Promise<void>,
) {
  const { db } = await vi.importActual<typeof import("../../packages/db/src/client")>(
    "../../packages/db/src/client",
  );
  await db.transaction(
    async (tx) => {
      active.db = tx;
      try {
        // Temporary copies isolate this read fixture from application data. Its outer
        // transaction owns DDL and inherits repeatable-read for repository savepoints.
        for (const name of [
          "users",
          "organizations",
          "organization_members",
          "servers",
          "server_observations",
        ])
          await tx.execute(
            sql`CREATE TEMP TABLE ${sql.identifier(name)} (LIKE ${sql.identifier("public")}.${sql.identifier(name)} INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
          );
        await tx.execute(sql`INSERT INTO users (id, email, username, display_name, role) VALUES
        ('owner', 'owner@test.invalid', 'owner', 'Owner', 'user'),
        ('delegate', 'delegate@test.invalid', 'delegate', 'Delegate', 'user'),
        ('admin', 'admin@test.invalid', 'admin', 'Admin', 'admin')`);
        await tx.execute(
          sql`INSERT INTO organizations (id, name, slug, owner_id) VALUES ('org', 'Org', 'org', 'owner')`,
        );
        await tx.execute(sql`INSERT INTO organization_members (id, organization_id, user_id, role, permissions)
        VALUES ('member', 'org', 'delegate', 'member', '["manage_servers"]'::jsonb)`);
        await tx.execute(sql`INSERT INTO servers (id, name, slug, ip_address, owner_id, organization_id, visibility) VALUES
        ('personal', 'Personal', 'personal', '203.0.113.1', 'owner', NULL, 'private'),
        ('team', 'Team', 'team', '203.0.113.2', 'delegate', 'org', 'private'),
        ('public', 'Public', 'public', '203.0.113.3', 'owner', NULL, 'public')`);
        await run(tx as unknown as typeof db, new Date(Date.now() - 1000));
      } finally {
        active.db = null;
      }
    },
    { isolationLevel: "repeatable read" },
  );
}
