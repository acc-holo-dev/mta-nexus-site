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
import { ServerRepository } from "../packages/db/src/repositories/servers";
import { OrganizationRepository } from "../packages/db/src/repositories/organizations";
it("checks personal and organization management scope with bounded pages on PostgreSQL", async () => {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  await db.transaction(
    async (tx) => {
      active.db = tx;
      try {
        for (const table of ["servers", "organizations", "organization_members"]) {
          await tx.execute(
            sql.raw(
              `CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
            ),
          );
        }
        await tx.execute(sql`INSERT INTO organizations (id, name, slug, owner_id) VALUES
        ('org-owned', 'Owned', 'owned', 'actor'), ('org-admin', 'Admin', 'admin', 'other'),
        ('org-role-owner', 'Role owner', 'role-owner', 'other'), ('org-permission', 'Permission', 'permission', 'other'),
        ('org-member', 'Member', 'member', 'other'), ('org-other', 'Other', 'other', 'other')`);
        await tx.execute(sql`INSERT INTO organization_members (id, organization_id, user_id, role, permissions) VALUES
        ('owned-member', 'org-owned', 'actor', 'owner', '[]'::jsonb),
        ('admin-member', 'org-admin', 'actor', 'admin', '[]'::jsonb),
        ('role-owner-member', 'org-role-owner', 'actor', 'owner', '[]'::jsonb),
        ('permission-member', 'org-permission', 'actor', 'developer', '["manage_servers"]'::jsonb),
        ('ordinary-member', 'org-member', 'actor', 'member', '["view_servers"]'::jsonb),
        ('unrelated-member', 'org-other', 'someone-else', 'admin', '[]'::jsonb)`);
        await tx.execute(sql`INSERT INTO servers (id, name, slug, ip_address, port, owner_id, visibility, updated_at)
        SELECT 'personal-' || lpad(n::text, 4, '0'), 'Personal ' || n, 'personal-' || n, '203.0.113.1', n, 'actor',
          CASE WHEN n % 2 = 0 THEN 'private' ELSE 'public' END, '2026-10-09T12:00:00Z'::timestamptz FROM generate_series(1, 130) n`);
        await tx.execute(sql`INSERT INTO servers (id, name, slug, ip_address, port, owner_id, organization_id, visibility, status, is_verified, updated_at) VALUES
        ('org-owned-server', 'Org owned', 'org-owned-server', '203.0.113.2', 1, 'other', 'org-owned', 'private', 'maintenance', true, '2026-10-09T12:00:00Z'),
        ('org-admin-server', 'Org admin', 'org-admin-server', '203.0.113.2', 2, 'other', 'org-admin', 'unlisted', 'active', true, '2026-10-09T12:00:00Z'),
        ('org-role-owner-server', 'Org role owner', 'org-role-owner-server', '203.0.113.2', 3, 'other', 'org-role-owner', 'public', 'active', true, '2026-10-09T12:00:00Z'),
        ('org-permission-server', 'Org permission', 'org-permission-server', '203.0.113.2', 4, 'other', 'org-permission', 'public', 'active', false, '2026-10-09T12:00:00Z'),
        ('ordinary-member-server', 'No management', 'ordinary-member-server', '203.0.113.2', 5, 'actor', 'org-member', 'private', 'active', false, '2026-10-09T12:00:00Z'),
        ('unrelated-server', 'Other member', 'unrelated-server', '203.0.113.2', 6, 'actor', 'org-other', 'private', 'active', false, '2026-10-09T12:00:00Z'),
        ('literal-server', 'Name %_ literal', 'literal-server', '203.0.113.2', 7, 'actor', NULL, 'private', 'maintenance', false, '2026-10-09T12:00:00Z'),
        ('unowned-server', 'No owner', 'unowned-server', '203.0.113.2', 8, NULL, NULL, 'private', 'active', false, '2026-10-09T12:00:00Z')`);
        const organizationRepository = new OrganizationRepository();
        const choices = await organizationRepository.listServerManageableByUser("actor");
        expect(choices.map((item) => item.id).sort()).toEqual([
          "org-admin", "org-owned", "org-permission",
        ]);
        expect(choices[0]).toEqual({
          id: expect.any(String), name: expect.any(String), slug: expect.any(String),
        });
        expect(await organizationRepository.listServerManageableByUser("outsider")).toEqual([]);
        await expect(organizationRepository.listServerManageableByUser(""))
          .rejects.toThrow("A user ID is required");
        expect(await organizationRepository.listServerManageableByUser("actor", 2))
          .toHaveLength(2);

        const repository = new ServerRepository();
        const first = await repository.pageManagedByUser("actor");
        expect(first).toMatchObject({ total: 135, page: 1, pageSize: 12, totalPages: 12 });
        expect(first.servers).toHaveLength(12);
        const all: string[] = [];
        for (let page = 1; page <= first.totalPages; page++)
          all.push(
            ...(await repository.pageManagedByUser("actor", page)).servers.map(
              (server) => server.id,
            ),
          );
        expect(new Set(all).size).toBe(134);
        expect(all).toEqual([...all].sort().reverse());
        expect(all).not.toContain("ordinary-member-server");
        expect(all).not.toContain("org-role-owner-server");
        expect(all).not.toContain("unrelated-server");
        expect(all).not.toContain("unowned-server");
        expect(all).toEqual(
          expect.arrayContaining([
            "org-owned-server",
            "org-admin-server",
            "org-permission-server",
          ]),
        );
        expect(await repository.pageManagedByUser("actor", 9999)).toMatchObject({
          page: 12,
          servers: expect.any(Array),
        });
        expect((await repository.pageManagedByUser("actor", 1, {}, 4)).servers).toHaveLength(4);
        const literal = await repository.pageManagedByUser("actor", 1, {
          query: "%_",
          visibility: "private",
          status: "maintenance",
          verification: "unverified",
        });
        expect(literal.total).toBe(1);
        expect(literal.servers[0]?.id).toBe("literal-server");
        expect(await repository.pageManagedByUser("outsider", 999)).toMatchObject({
          total: 0,
          page: 1,
          servers: [],
        });
        expect(
          (await repository.pageManagedByUser("someone-else")).servers.map((server) => server.id),
        ).toEqual(["unrelated-server"]);
        // The following request reads fresh rights; earlier HTML cannot retain a revoked membership.
        await tx.execute(sql`DELETE FROM organization_members WHERE id = 'permission-member'`);
        expect((await repository.pageManagedByUser("actor")).total).toBe(134);
        expect((await organizationRepository.listServerManageableByUser("actor"))
          .map((item) => item.id)).not.toContain("org-permission");
      } finally {
        active.db = null;
      }
    },
    { isolationLevel: "repeatable read" },
  );
}, 30_000);
