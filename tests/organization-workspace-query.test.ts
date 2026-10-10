import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { organizationMembers, organizations } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
vi.mock("../packages/db/src/repositories/organization-access-notice", () => ({
  storeOrganizationAccessNotice: vi.fn(),
}));

import { organizationWorkspaceRepository as repository } from "../packages/db/src/repositories/organization-workspace";

const version = new Date("2026-10-10T12:00:00.000Z");
const organization = {
  id: "org",
  name: "Team",
  slug: "team",
  description: null,
  logoUrl: null,
  websiteUrl: null,
  isVerified: false,
  ownerId: "owner",
  createdAt: version.toISOString(),
  updatedAt: version.toISOString(),
};
const orgRow = (overrides = {}) =>
  Object.keys(getTableColumns(organizations)).map(
    (key) => ({ ...organization, ...overrides })[key as keyof typeof organization],
  );
const memberRow = (overrides = {}) =>
  Object.keys(getTableColumns(organizationMembers)).map(
    (key) =>
      ({
        id: "membership",
        organizationId: "org",
        userId: "target",
        role: "developer",
        permissions: ["manage_products", "custom", "manage_servers"],
        createdAt: version.toISOString(),
        ...overrides,
      })[key as "id"],
  );
const fields = { name: "Updated team", description: "", logoUrl: "", websiteUrl: "" };
const audit = {
  id: "audit",
  actorId: "owner",
  actorType: "user" as const,
  action: "organization.member_updated",
  targetId: "org",
  targetType: "organization",
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = null;
});
it("bounds own organization pages and uses SQL membership scope and stable ordering", async () => {
  await repository.pageMine("actor", 2, "%_");
  const query = state.queries[0];
  expect(query.sql).toContain("exists (select");
  expect(query.sql).toContain('"organizations"."owner_id" =');
  expect(query.sql).toContain(
    'order by "organizations"."updated_at" desc, "organizations"."id" desc',
  );
  expect(query.params).toContain("%\\%\\_%");
  expect(query.params.slice(-2)).toEqual([21, 20]);
});
it("reads workspace identity and filtered team in one private snapshot", async () => {
  state.rows = [[orgRow()], [["owner", "owner", "Owner", null]], []];
  const result = await repository.getWorkspace("org", "owner", 2, "%_");
  expect(result.role).toBe("owner");
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  const query = state.queries[state.queries.length - 1];
  expect(query.sql).toContain('"organization_members"."organization_id" =');
  expect(query.sql).toContain(
    'order by "organization_members"."created_at" asc, "organization_members"."id" asc',
  );
  expect(query.params.slice(-2)).toEqual([21, 20]);
  expect(query.sql.split(" from ")[0]).not.toMatch(/email|password|manage_products/u);
});
it("denies nonmembers and forged legacy owner memberships", async () => {
  state.rows = [[orgRow()], [["owner"]]];
  await expect(repository.getWorkspace("org", "outsider")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(2);
});
it("locks profile authority and rejects stale revisions before update/audit", async () => {
  state.rows = [[orgRow()]];
  await expect(
    repository.updateProfile("org", "owner", new Date(version.getTime() - 1), fields, audit),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries).toHaveLength(1);
});
it("holds the current administrator grant and saves only public profile fields", async () => {
  state.rows = [[orgRow()], [["admin"]], [orgRow({ name: fields.name })], []];
  await repository.updateProfile("org", "admin", version, fields, { ...audit, actorId: "admin" });
  expect(state.queries[1].sql).toContain("for share");
  const update = state.queries[2].sql;
  expect(update).toContain('"name" =');
  expect(update).toContain("interval '1 millisecond'");
  expect(update).not.toMatch(/"owner_id" =|"slug" =|"is_verified" =/u);
  expect(state.queries[3].sql).toContain('insert into "audit_events"');
});
it("denies developer profile writes after reading live role", async () => {
  state.rows = [[orgRow()], [["developer"]]];
  await expect(
    repository.updateProfile("org", "developer", version, fields, audit),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries).toHaveLength(2);
});
it("protects owner removal regardless of membership records", async () => {
  state.rows = [[orgRow()], []];
  await expect(
    repository.changeMember("org", "owner", version, "owner", null, audit),
  ).rejects.toMatchObject({ code: "MEMBER_PROTECTED" });
  expect(state.queries.some((q) => q.sql.startsWith("delete"))).toBe(false);
});
it("prevents administrators from promoting peers or removing administrators", async () => {
  state.rows = [[orgRow()], [["admin"]], [memberRow({ role: "admin" })]];
  await expect(
    repository.changeMember("org", "administrator", version, "target", null, audit),
  ).rejects.toMatchObject({ code: "MEMBER_PROTECTED" });
  expect(state.queries).toHaveLength(3);
});
it("retains commercial/custom permissions during a server permission change", async () => {
  state.rows = [
    [orgRow()],
    [memberRow()],
    [],
    [orgRow({ updatedAt: new Date(version.getTime() + 1).toISOString() })],
    [],
  ];
  const result = await repository.changeMember(
    "org",
    "owner",
    version,
    "target",
    { role: "member", managesServers: false },
    audit,
  );
  expect(result).toMatchObject({ userId: "target", role: "member", managesServers: false });
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[2].params).toContain(JSON.stringify(["manage_products", "custom"]));
  expect(state.queries.at(-1)?.sql).toContain('insert into "audit_events"');
});
it("rejects duplicate member creation without revision/audit writes", async () => {
  state.rows = [[orgRow()], [["target", "target", "Target", null]], []];
  await expect(
    repository.addMember("org", "owner", version, "target", "member", false, "mem", audit),
  ).rejects.toMatchObject({ code: "MEMBER_EXISTS" });
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain("on conflict");
  expect(state.queries).toHaveLength(3);
});
it("does not look up an account before rejecting an unauthorized administrator grant", async () => {
  state.rows = [[orgRow()], [["admin"]]];
  await expect(
    repository.addMember("org", "admin", version, "target", "admin", false, "mem", audit),
  ).rejects.toMatchObject({ code: "MEMBER_PROTECTED" });
  expect(state.queries).toHaveLength(2);
});
it("creates the owner membership and audit with an unverified profile in one transaction", async () => {
  state.rows = [[orgRow()], [], []];
  await repository.create(
    "org",
    "owner",
    "team",
    { name: "Team", description: "", logoUrl: "", websiteUrl: "" },
    audit,
  );
  expect(state.queries.map((q) => q.sql.match(/insert into "([^"]+)"/u)?.[1])).toEqual([
    "organizations",
    "organization_members",
    "audit_events",
  ]);
  expect(state.queries[0].params).toContain(false);
  expect(state.queries[1].params).toContain("owner");
});
it("lets a regular member revoke only their own membership under the organization lock", async () => {
  state.rows = [
    [orgRow()],
    [["member"]],
    [["actor"]],
    [orgRow({ updatedAt: new Date(version.getTime() + 1).toISOString() })],
    [],
  ];
  const result = await repository.leave("org", "actor", version, { ...audit, actorId: "actor" });
  expect(result).toMatchObject({ userId: "actor", removed: true });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].params).toEqual(["org", "actor"]);
  expect(state.queries[2].sql).toContain('delete from "organization_members"');
});
it("prevents the owner from leaving and rejects stale voluntary exits", async () => {
  state.rows = [[orgRow()]];
  await expect(repository.leave("org", "owner", version, audit)).rejects.toMatchObject({
    code: "MEMBER_PROTECTED",
  });
  state.queries = [];
  state.rows = [[orgRow()], [["developer"]]];
  await expect(
    repository.leave("org", "actor", new Date(version.getTime() - 1), audit),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries).toHaveLength(2);
});
