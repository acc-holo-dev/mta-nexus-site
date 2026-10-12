import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { organizations } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
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
          return (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { organizationGovernanceRepository as team } from "../packages/db/src/repositories/organization-governance";
import { profileChangeHistoryRepository as profile } from "../packages/db/src/repositories/profile-change-history";

const stamp = "2026-10-12T00:00:00.123456Z",
  base = { period: "all" as const, group: "all" as const, query: "" };
const fingerprint = (
  scope: string,
  actor: string,
  target: string,
  period: string,
  group: string,
  query = "",
) =>
  createHash("sha256")
    .update(JSON.stringify([1, scope, actor, target, period, group, query]))
    .digest("hex");
const org = () => {
  const value = {
    id: "org",
    ownerId: "owner",
    name: "Team",
    slug: "team",
    createdAt: stamp,
    updatedAt: stamp,
  };
  return Object.keys(getTableColumns(organizations)).map(
    (key) => value[key as keyof typeof value] ?? null,
  );
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = undefined;
});
it("scopes profile history to the actual target account with bounded field-name projections", async () => {
  state.rows = [[["owner"]], [[stamp]], []];
  const result = await profile.page("owner", base);
  expect(result).toMatchObject({
    username: "owner",
    until: stamp,
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(3);
  const page = state.queries[2];
  expect(page.params).toEqual(
    expect.arrayContaining([
      "user",
      "owner",
      "user.profile_updated",
      "developer.profile_updated",
      "user.privacy_updated",
      stamp,
      21,
    ]),
  );
  expect(page.sql).toContain('order by "audit_events"."created_at" desc, "audit_events"."id" desc');
  expect(page.sql).toContain("with ordinality");
  expect(page.sql).toContain("field.ordinal between 4 and 6");
  expect(page.sql).toContain("'true'::jsonb");
  expect(page.sql.split(' from "audit_events"')[0]).not.toMatch(
    /ip_address|user_agent|password|email|"details"[, ]/u,
  );
});
it.each([
  ["profile", "user.profile_updated"],
  ["professional", "developer.profile_updated"],
  ["privacy", "user.privacy_updated"],
] as const)(
  "filters %s operations before applying the precise seven-day window",
  async (group, action) => {
    state.rows = [[["owner"]], [[stamp]], []];
    await profile.page("owner", { ...base, period: "7", group });
    const query = state.queries[2];
    expect(query.params).toContain(action);
    expect(query.params).toContain(7);
    expect(query.sql).toContain("interval '1 day'");
    expect(query.sql).toContain("::timestamptz");
    for (const other of [
      "user.profile_updated",
      "developer.profile_updated",
      "user.privacy_updated",
    ].filter((value) => value !== action))
      expect(query.params).not.toContain(other);
  },
);
it("returns twenty rows and a bound cursor even when timestamps tie at microsecond precision", async () => {
  state.rows = [
    [["owner"]],
    [[stamp]],
    Array.from({ length: 21 }, (_, i) => [
      `a${i}`,
      "user.profile_updated",
      stamp,
      ["bio"],
      false,
      "you",
    ]),
  ];
  const result = await profile.page("owner", base);
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({
    version: 1,
    context: fingerprint("profile-change-history", "owner", "owner", "all", "all"),
    until: stamp,
    id: "a19",
  });
});
it("resolves a profile anchor within the same actor, filters and retained cutoff", async () => {
  const cursor = {
    version: 1 as const,
    context: fingerprint("profile-change-history", "owner", "owner", "30", "privacy"),
    until: stamp,
    id: "anchor",
  };
  state.rows = [[["owner"]], [["2026-10-12T00:01:00.000000Z"]], [["anchor", stamp]], []];
  await profile.page("owner", { ...base, period: "30", group: "privacy", cursor, until: stamp });
  expect(state.queries[2].params).toEqual(
    expect.arrayContaining(["owner", "user.privacy_updated", stamp, 30, "anchor", 1]),
  );
  expect(state.queries[3].params).toEqual(expect.arrayContaining([stamp, "anchor", 21]));
  expect(state.queries[3].sql).toContain('("audit_events"."created_at","audit_events"."id")<');
});
it("rejects missing anchors without falling back to the latest page", async () => {
  state.rows = [[["owner"]], [[stamp]], []];
  await expect(
    profile.page("owner", {
      ...base,
      cursor: {
        version: 1,
        context: fingerprint("profile-change-history", "owner", "owner", "all", "all"),
        until: stamp,
        id: "gone",
      },
    }),
  ).rejects.toMatchObject({ code: "CHANGE_HISTORY_EXPIRED" });
  expect(state.queries).toHaveLength(3);
});
it.each(["actor", "group", "period"])(
  "rejects replayed profile cursor after changing %s before database access",
  async (change) => {
    const cursor = {
      version: 1 as const,
      context: fingerprint("profile-change-history", "owner", "owner", "all", "all"),
      until: stamp,
      id: "anchor",
    };
    await expect(
      profile.page(change === "actor" ? "foreign" : "owner", {
        ...base,
        group: change === "group" ? "privacy" : "all",
        period: change === "period" ? "7" : "all",
        cursor,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it.each(["bad", "2026-02-30T00:00:00.123456Z", "0000-01-01T00:00:00.000000Z", ""])(
  "rejects invalid explicit cutoff %s at storage",
  async (until) => {
    await expect(profile.page("owner", { ...base, until })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    expect(state.queries).toHaveLength(0);
  },
);
it("rejects a missing account and a future cutoff rather than producing an empty success", async () => {
  await expect(profile.page("missing", base)).rejects.toMatchObject({ code: "NOT_FOUND" });
  state.rows = [[["owner"]], [[stamp]]];
  await expect(
    profile.page("owner", { ...base, until: "2026-10-13T00:00:00.000000Z" }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("fails closed when the database clock is absent or malformed", async () => {
  state.rows = [[["owner"]], [["bad"]]];
  await expect(profile.page("owner", base)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  expect(state.queries).toHaveLength(2);
});
it("filters organization membership by current public accounts using escaped search before the page limit", async () => {
  state.rows = [[org()], [[stamp]], []];
  const filters = { ...base, group: "team" as const, period: "30" as const, query: "%_" };
  await team.history("org", "owner", undefined, filters);
  const query = state.queries[2];
  expect(query.params).toEqual(
    expect.arrayContaining([
      "organization",
      "org",
      "organization.member_updated",
      30,
      "%\\%\\_%",
      21,
    ]),
  );
  expect(query.params).not.toContain("organization.ownership_transferred");
  expect(query.sql).toContain('"organization_activity_subject"."username" ilike');
  expect(query.sql).not.toMatch(/email|password|ip_address|user_agent/u);
});
it("binds organization pages to manager, target, group, search and exact window", async () => {
  const filters = {
    ...base,
    group: "ownership" as const,
    query: "Owner",
    cursor: {
      version: 1 as const,
      context: fingerprint(
        "organization-change-history",
        "owner",
        "org",
        "all",
        "ownership",
        "Owner",
      ),
      until: stamp,
      id: "anchor",
    },
  };
  state.rows = [[org()], [[stamp]], [["anchor", stamp]], []];
  expect((await team.history("org", "owner", undefined, filters)).until).toBe(stamp);
  expect(state.queries[2].params).toContain("organization.ownership_transferred");
  expect(state.queries[2].params).toContain("%Owner%");
  expect(state.queries[3].params).toEqual(expect.arrayContaining([stamp, "anchor", 21]));
  await expect(team.history("other", "owner", undefined, filters)).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
});
it("rechecks live membership before reading the clock or audit rows", async () => {
  state.rows = [[org()], [["member"]]];
  await expect(team.history("org", "foreign", undefined, base)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries.some((query) => query.sql.includes('from "audit_events"'))).toBe(false);
});
