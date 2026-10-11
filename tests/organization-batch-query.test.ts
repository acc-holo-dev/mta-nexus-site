import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  notice: vi.fn(),
  fail: "",
}));
vi.mock("../packages/db/src/repositories/organization-access-notice", () => ({
  storeOrganizationAccessNotice: state.notice,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.fail && sql.startsWith(`insert into "${state.fail}"`))
      throw new Error("Required write unavailable");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (callback: (tx: typeof database) => unknown) => callback(proxy);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});

import { organizationWorkspaceRepository as repository } from "../packages/db/src/repositories/organization-workspace";
import { organizations } from "../packages/db/src/schema";

const time = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:00.001Z";
const org = (extra = {}) =>
  Object.keys(getTableColumns(organizations)).map(
    (key) =>
      ({
        id: "org",
        name: "Team",
        slug: "team",
        ownerId: "owner",
        createdAt: time,
        updatedAt: time,
        ...extra,
      })[key as "id"],
  );
const members = [
  ["m-a", "a", "member", ["manage_resources", "manage_servers"], "alice", "Alice"],
  ["m-b", "b", "developer", ["commercial_custom"], "bob", "Bob"],
];
const input = {
  userIds: ["b", "a"],
  change: { action: "role", role: "developer" } as const,
  expectedUpdatedAt: new Date(time),
};
const audits = input.userIds.map((id) => ({
  id: `audit-${id}`,
  actorId: "owner",
  actorType: "user" as const,
  targetType: "organization",
  targetId: "org",
  action: "organization.member_updated",
}));
const writes = () => state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
async function preview(extra = {}, rows = members) {
  state.rows = [[org(extra)], rows];
  return repository.previewMembers("org", "owner", input);
}
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.fail = "";
  state.notice.mockReset().mockResolvedValue(undefined);
});
it("reviews current scoped identities without leaking permission grants and binds unordered selections", async () => {
  const result = await preview();
  expect(result.changedCount).toBe(1);
  expect(result.members.map((member) => member.userId)).toEqual(["a", "b"]);
  expect(result.members[0]).toMatchObject({
    before: { role: "member", managesServers: true },
    after: { role: "developer", managesServers: true },
    changed: true,
  });
  expect(JSON.stringify(result)).not.toMatch(/manage_resources|commercial_custom|permissions|m-a/u);
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain('for share of "organization_members"');
  expect(state.queries[1].sql).toContain('order by "organization_members"."user_id" asc');
  expect(state.queries[1].params).toEqual(expect.arrayContaining(["org", "a", "b"]));
  expect(writes()).toEqual([]);
  state.rows = [[org()], members];
  const reordered = await repository.previewMembers("org", "owner", {
    ...input,
    userIds: ["a", "b"],
  });
  expect(reordered.previewRevision).toBe(result.previewRevision);
});
it("writes only changed members once, retains commercial grants, bumps one version and emits existing per-member events", async () => {
  const reviewed = await preview();
  state.queries = [];
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  const result = await repository.batchMembers(
    "org",
    "owner",
    { ...input, previewRevision: reviewed.previewRevision },
    audits,
  );
  expect(result.changedUserIds).toEqual(["a"]);
  expect(result.organization.updatedAt.toISOString()).toBe(later);
  const changes = writes();
  expect(
    changes.filter((query) => query.sql.startsWith('update "organization_members"')),
  ).toHaveLength(1);
  expect(changes[0].params).toContain(JSON.stringify(["manage_resources", "manage_servers"]));
  expect(changes.filter((query) => query.sql.startsWith('update "organizations"'))).toHaveLength(1);
  expect(
    changes.find((query) => query.sql.startsWith('insert into "audit_events"'))?.params,
  ).toContain("audit-a");
  expect(state.notice).toHaveBeenCalledTimes(1);
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: "org" }),
    "a",
    "updated",
    "audit-a",
  );
});
it("rejects stale review, current permission changes and changed action before all writes", async () => {
  const reviewed = await preview();
  for (const changed of [
    { ...input, previewRevision: "f".repeat(64) },
    { ...input, previewRevision: reviewed.previewRevision, change: { action: "remove" } as const },
  ]) {
    state.queries = [];
    state.rows = [[org()], members];
    await expect(repository.batchMembers("org", "owner", changed, audits)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(writes()).toEqual([]);
  }
  state.queries = [];
  state.rows = [
    [org()],
    members.map((row, i) =>
      i === 0 ? [row[0], row[1], row[2], ["different_commercial_grant"], row[4], row[5]] : row,
    ),
  ];
  await expect(
    repository.batchMembers(
      "org",
      "owner",
      { ...input, previewRevision: reviewed.previewRevision },
      audits,
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(writes()).toEqual([]);
});
it.each(["owner", "admin"])(
  "rejects protected %s target and missing members atomically",
  async (role) => {
    state.rows = [
      [org({ ownerId: "actual-owner" })],
      [["admin"]],
      [["m", "a", role, [], "alice", "Alice"], members[1]],
    ];
    await expect(repository.previewMembers("org", "owner", input)).rejects.toMatchObject({
      code: "MEMBER_PROTECTED",
    });
    expect(writes()).toEqual([]);
    state.rows = [[org()], [members[0]]];
    await expect(repository.previewMembers("org", "owner", input)).rejects.toMatchObject({
      code: "MEMBER_NOT_FOUND",
    });
    expect(writes()).toEqual([]);
  },
);
it("denies ordinary members, obsolete organization versions, duplicate and oversized selections", async () => {
  state.rows = [[org({ ownerId: "different" })], [["member"]]];
  await expect(repository.previewMembers("org", "owner", input)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(2);
  state.rows = [[org({ updatedAt: later })]];
  await expect(repository.previewMembers("org", "owner", input)).rejects.toMatchObject({
    code: "CONFLICT",
  });
  for (const userIds of [["a", "a"], [], Array.from({ length: 21 }, (_, i) => `user-${i}`)])
    await expect(
      repository.previewMembers("org", "owner", { ...input, userIds }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(writes()).toEqual([]);
});
it("preserves role when changing only delegated access and deletes a reviewed group in one command", async () => {
  const change = { action: "server_access", enabled: false } as const;
  state.rows = [[org()], members];
  const reviewed = await repository.previewMembers("org", "owner", { ...input, change });
  state.queries = [];
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  await repository.batchMembers(
    "org",
    "owner",
    { ...input, change, previewRevision: reviewed.previewRevision },
    audits,
  );
  expect(writes()[0].params).toContain("member");
  expect(writes()[0].params).toContain(JSON.stringify(["manage_resources"]));
  const remove = { action: "remove" } as const;
  state.rows = [[org()], members];
  const removal = await repository.previewMembers("org", "owner", { ...input, change: remove });
  state.queries = [];
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  const result = await repository.batchMembers(
    "org",
    "owner",
    { ...input, change: remove, previewRevision: removal.previewRevision },
    audits,
  );
  expect(result.changedUserIds).toEqual(["a", "b"]);
  expect(writes().filter((query) => query.sql.startsWith("delete"))).toHaveLength(1);
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    "b",
    "removed",
    "audit-b",
  );
});
it("propagates mandatory audit and inbox failures to the enclosing transaction", async () => {
  const reviewed = await preview();
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  state.fail = "audit_events";
  await expect(
    repository.batchMembers(
      "org",
      "owner",
      { ...input, previewRevision: reviewed.previewRevision },
      audits,
    ),
  ).rejects.toThrow();
  expect(state.notice).not.toHaveBeenCalled();
  state.fail = "";
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  state.notice.mockRejectedValue(new Error("Inbox unavailable"));
  await expect(
    repository.batchMembers(
      "org",
      "owner",
      { ...input, previewRevision: reviewed.previewRevision },
      audits,
    ),
  ).rejects.toThrow("Inbox unavailable");
});
