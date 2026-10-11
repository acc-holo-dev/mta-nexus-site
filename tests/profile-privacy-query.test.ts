import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { profilePrivacyRepository as privacy } from "../packages/db/src/repositories/profile-privacy";
import { publicationFeedRepository as feed } from "../packages/db/src/repositories/publication-feed";
import { developerProfileRepository as professional } from "../packages/db/src/repositories/developer-profile";
const time = "2026-10-10T00:00:00.000Z",
  later = "2026-10-10T00:00:00.001Z";
const input = {
  actorId: "actor",
  showActivity: false,
  showProfessionalContacts: false,
  expectedUpdatedAt: new Date(time),
  auditId: "audit",
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
});
const writes = () => state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
it("reads settings only for the supplied actor with missing-row defaults and a narrow projection", async () => {
  state.rows = [[["actor", "member", time, true, true]]];
  expect(await privacy.own("actor")).toMatchObject({
    id: "actor",
    username: "member",
    showActivity: true,
    showProfessionalContacts: true,
    updatedAt: new Date(time),
  });
  expect(state.queries[0].params).toEqual(["actor", 1]);
  expect(state.queries[0].sql).toContain('left join "user_profile_preferences"');
  expect(state.queries[0].sql).toContain(
    'coalesce("user_profile_preferences"."show_activity", true)',
  );
  expect(state.queries[0].sql.split(" from ")[0]).not.toMatch(/email|password|role|two_factor/u);
});
it("keeps public visibility free of private account identity and revision", async () => {
  state.rows = [[[false, true]]];
  expect(await privacy.visibility("actor")).toEqual({
    showActivity: false,
    showProfessionalContacts: true,
  });
  expect(state.queries[0].params).toEqual(["actor", 1]);
  expect(state.queries[0].sql.split(" from ")[0]).not.toMatch(/updated_at|email|username/u);
  expect(await privacy.visibility("missing")).toBeNull();
  await expect(privacy.own("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("locks the shared user revision before upserting visibility and atomically writes a monotonic revision and narrow audit", async () => {
  state.rows = [[["actor", "member", time]], [[later]]];
  expect(await privacy.update(input)).toEqual({
    id: "actor",
    username: "member",
    showActivity: false,
    showProfessionalContacts: false,
    updatedAt: new Date(later),
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].params).toEqual(["actor", 1]);
  expect(writes().map((query) => query.sql.split(" ").slice(0, 3).join(" "))).toEqual([
    'insert into "user_profile_preferences"',
    'update "users" set',
    'insert into "audit_events"',
  ]);
  expect(writes()[0].sql).toContain('on conflict ("user_id") do update');
  expect(writes()[0].params).toEqual(["actor", false, false, false, false]);
  expect(writes()[1].sql).toContain("interval '1 millisecond'");
  expect(writes()[1].sql).not.toMatch(/display_name|password|is_verified/u);
  expect(writes()[2].params).toContain("user.privacy_updated");
  expect(writes()[2].params.join(" ")).not.toContain("member");
});
it.each([
  { rows: [], code: "NOT_FOUND" },
  { rows: [["actor", "member", later]], code: "CONFLICT" },
])(
  "rejects a deleted actor or a stale shared revision without writes %j",
  async ({ rows, code }) => {
    state.rows = [rows];
    await expect(privacy.update(input)).rejects.toMatchObject({ code });
    expect(writes()).toHaveLength(0);
  },
);
it("propagates an audit failure without confirming a save", async () => {
  state.rows = [[["actor", "member", time]], [[later]]];
  state.failAudit = true;
  await expect(privacy.update(input)).rejects.toMatchObject({
    cause: expect.objectContaining({ message: "audit failure" }),
  });
});
it("removes professional contacts in SQL while keeping private editing and experience fields intact", async () => {
  await professional.publicProfile("actor");
  const query = state.queries[0].sql;
  expect(query).toContain(
    'case when coalesce("user_profile_preferences"."show_professional_contacts", true) then "developer_profiles"."github_url" else null end',
  );
  expect(query).toContain('then "developer_profiles"."discord_tag" else null end');
  expect(query).toContain('"developer_profiles"."verified_developer"');
  state.rows = [[["Lua"], "https://portfolio.test", "discord", true, time, "actor"]].map((row) => [
    row,
  ]);
  await professional.own("actor");
  expect(state.queries[1].sql).not.toContain("case when");
  expect(state.queries[1].sql).not.toContain('"user_profile_preferences"');
});
it("checks visibility on direct profile resolution and on every page rather than relying on a UI link", async () => {
  await feed.resolvePublicScope("user", "member");
  await feed.page({ kind: "user", id: "actor" });
  for (const query of state.queries) {
    expect(query.sql).toContain('coalesce("user_profile_preferences"."show_activity", true)');
    expect(query.sql).toContain('left join "user_profile_preferences"');
  }
  expect(state.queries[1].params).toContain("actor");
  expect(state.queries[1].params.at(-1)).toBe(21);
});
it("gates the user subscription source including combined feeds but keeps organization contexts public", async () => {
  await feed.page({ kind: "following", actorId: "follower" }, { source: "user" });
  await feed.page({ kind: "following", actorId: "follower" });
  await feed.page({ kind: "following", actorId: "follower" }, { source: "organization" });
  await feed.page({ kind: "organization", id: "org" });
  await feed.resolvePublicScope("organization", "team");
  for (const query of state.queries.slice(0, 2))
    expect(query.sql).toContain('coalesce("user_profile_preferences"."show_activity", true)');
  for (const query of state.queries.slice(2))
    expect(query.sql).not.toContain('coalesce("user_profile_preferences"."show_activity", true)');
  expect(state.queries[2].params).toContain("organization");
});
