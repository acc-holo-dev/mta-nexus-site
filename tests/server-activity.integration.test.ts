import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
const active = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../packages/db/src/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../packages/db/src/client")>();
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
});
import { AuditRepository } from "../packages/db/src/repositories/audit";

it("reads scoped private activity on PostgreSQL without losing tied or microsecond events", async () => {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  await db.transaction(
    async (tx) => {
      active.db = tx;
      try {
        for (const table of [
          "users",
          "servers",
          "organizations",
          "organization_members",
          "audit_events",
        ])
          await tx.execute(
            sql.raw(
              `CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
            ),
          );
        await tx.execute(sql`INSERT INTO users (id, email, username, display_name, password_hash) VALUES
        ('actor', 'private@example.invalid', 'manager', 'Manager', 'secret_hash'),
        ('editor', 'secret@example.invalid', 'editor', 'Editor', 'secret_editor_hash')`);
        await tx.execute(sql`INSERT INTO organizations (id, name, slug, owner_id) VALUES
        ('org-owned', 'Owned', 'owned', 'owner'), ('org-member', 'Member', 'member', 'other')`);
        await tx.execute(sql`INSERT INTO organization_members (id, organization_id, user_id, role, permissions) VALUES
        ('grant', 'org-member', 'actor', 'member', '["manage_servers"]'::jsonb),
        ('orphan', 'org-missing', 'actor', 'admin', '[]'::jsonb)`);
        await tx.execute(sql`INSERT INTO servers (id, name, slug, ip_address, port, owner_id, organization_id, visibility) VALUES
        ('personal', 'Personal', 'personal', '203.0.113.1', 22003, 'actor', NULL, 'private'),
        ('org-server', 'Org', 'org-server', '203.0.113.2', 22003, 'legacy-creator', 'org-member', 'private'),
        ('owned-server', 'Owned', 'owned-server', '203.0.113.3', 22003, NULL, 'org-owned', 'private'),
        ('orphan-server', 'Orphan', 'orphan-server', '203.0.113.4', 22003, 'actor', 'org-missing', 'private')`);
        await tx.execute(sql`INSERT INTO audit_events (id, actor_id, action, target_id, target_type, details, ip_address, user_agent, created_at)
        SELECT 'aud_' || lpad(n::text, 3, '0'), 'editor', 'server.updated', 'personal', 'server',
          '{"fields":["visibility","passwordHash","name","name",{"secret":"token"}],"token":"never_expose"}'::jsonb,
          '192.0.2.99', 'secret_agent', '2026-10-10T10:00:00Z'::timestamptz FROM generate_series(1, 60) n`);
        await tx.execute(sql`INSERT INTO audit_events (id, actor_id, action, target_id, target_type, details, created_at) VALUES
        ('aud_micro_a', 'actor', 'server.created', 'personal', 'server', '{}', '2026-10-10T10:00:00.000125Z'),
        ('aud_micro_z', 'actor', 'server.claim_challenge_issued', 'personal', 'server', '{}', '2026-10-10T10:00:00.000124Z'),
        ('aud_micro_y', 'actor', 'server.updated', 'personal', 'server', '{"fields":"malformed"}', '2026-10-10T10:00:00.000123Z'),
        ('aud_foreign', 'actor', 'server.updated', 'org-server', 'server', '{}', '2026-10-10T10:00:00Z'),
        ('aud_wrong_type', 'actor', 'server.updated', 'personal', 'product', '{}', '2026-10-10T11:00:00Z'),
        ('aud_internal', 'actor', 'server.internal_sensitive', 'personal', 'server', '{}', '2026-10-10T11:00:00Z')`);
        const repository = new AuditRepository();
        const actor = { id: "actor", role: "user" as const };
        const first = await repository.pageForManagedServer("personal", actor, undefined, 1);
        expect(first?.events[0].id).toBe("aud_micro_a");
        const second = await repository.pageForManagedServer(
          "personal",
          actor,
          first?.nextCursor ?? undefined,
          1,
        );
        expect(second?.events[0].id).toBe("aud_micro_z");
        const third = await repository.pageForManagedServer(
          "personal",
          actor,
          second?.nextCursor ?? undefined,
          1,
        );
        expect(third?.events[0].id).toBe("aud_micro_y");
        expect(third?.events[0].fields).toEqual([]);

        const ids: string[] = [];
        let cursor: string | undefined;
        do {
          const page = await repository.pageForManagedServer("personal", actor, cursor, 20);
          expect(page?.events.length).toBeLessThanOrEqual(20);
          ids.push(...(page?.events.map((row) => row.id) ?? []));
          cursor = page?.nextCursor ?? undefined;
        } while (cursor);
        expect(ids).toHaveLength(63);
        expect(new Set(ids).size).toBe(63);
        expect(ids.slice(0, 3)).toEqual(["aud_micro_a", "aud_micro_z", "aud_micro_y"]);
        expect(ids.slice(3)).toEqual(
          Array.from({ length: 60 }, (_, i) => `aud_${String(60 - i).padStart(3, "0")}`),
        );
        const tied = await repository.pageForManagedServer("personal", actor, "aud_micro_y", 1);
        expect(tied?.events[0].fields).toEqual(["name", "visibility"]);
        expect(tied?.events[0]).toMatchObject({
          actorUsername: "editor",
          actorDisplayName: "Editor",
        });
        expect(JSON.stringify(tied)).not.toMatch(/secret|never_expose|passwordHash|192\.0\.2\.99/);

        await tx.execute(sql`INSERT INTO audit_events (id, actor_id, action, target_id, target_type, created_at)
        VALUES ('aud_new', 'actor', 'server.updated', 'personal', 'server', '2026-10-10T12:00:00Z')`);
        expect(
          (await repository.pageForManagedServer("personal", actor, "aud_micro_y", 50))?.events.map(
            (row) => row.id,
          ),
        ).not.toContain("aud_new");
        for (const invalid of ["aud_foreign", "aud_wrong_type", "aud_internal", "aud_absent"])
          expect(
            (await repository.pageForManagedServer("personal", actor, invalid))?.events,
          ).toEqual([]);
        await tx.execute(sql`DELETE FROM audit_events WHERE id = 'aud_micro_y'`);
        expect(
          (await repository.pageForManagedServer("personal", actor, "aud_micro_y"))?.events,
        ).toEqual([]);

        expect(
          await repository.pageForManagedServer("personal", { id: "outsider", role: "user" }),
        ).toBeNull();
        expect(
          await repository.pageForManagedServer("personal", { id: "moderator", role: "moderator" }),
        ).toBeNull();
        expect(
          await repository.pageForManagedServer("personal", { id: "admin", role: "admin" }),
        ).not.toBeNull();
        expect(
          await repository.pageForManagedServer("org-server", {
            id: "legacy-creator",
            role: "user",
          }),
        ).toBeNull();
        expect(await repository.pageForManagedServer("org-server", actor)).not.toBeNull();
        for (const role of ["admin"]) {
          await tx.execute(
            sql`UPDATE organization_members SET role = ${role}, permissions = '[]'::jsonb WHERE id = 'grant'`,
          );
          expect(await repository.pageForManagedServer("org-server", actor)).not.toBeNull();
        }
        await tx.execute(
          sql`UPDATE organization_members SET role = 'member', permissions = '["view_servers"]'::jsonb WHERE id = 'grant'`,
        );
        expect(await repository.pageForManagedServer("org-server", actor)).toBeNull();
        await tx.execute(
          sql`UPDATE organization_members SET permissions = '["manage_servers"]'::jsonb WHERE id = 'grant'`,
        );
        expect(
          await repository.pageForManagedServer("owned-server", { id: "owner", role: "user" }),
        ).not.toBeNull();
        expect(await repository.pageForManagedServer("orphan-server", actor)).toBeNull();
        await tx.execute(sql`DELETE FROM organization_members WHERE id = 'grant'`);
        expect(await repository.pageForManagedServer("org-server", actor)).toBeNull();
        await tx.execute(
          sql`UPDATE organizations SET owner_id = 'replacement-owner' WHERE id = 'org-owned'`,
        );
        expect(
          await repository.pageForManagedServer("owned-server", { id: "owner", role: "user" }),
        ).toBeNull();
        await tx.execute(sql`UPDATE servers SET owner_id = 'other' WHERE id = 'personal'`);
        expect(await repository.pageForManagedServer("personal", actor)).toBeNull();
      } finally {
        active.db = null;
      }
    },
    { isolationLevel: "repeatable read" },
  );
}, 30_000);
