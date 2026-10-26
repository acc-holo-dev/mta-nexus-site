import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  clock: null as null | (() => void),
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    state.clock?.();
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { resourceReviewsRepository as repo } from "../packages/db/src/repositories/resource-reviews";
const product = ["prd_a", "Resource", "resource", "published", "usr_publisher", null];
const input = {
  actorId: "usr_a",
  productId: "prd_a",
  reviewId: "cmt_a",
  auditId: "aud_a",
  command: { action: "save" as const, expectedRevision: 0, text: "Useful resource", rating: 5 },
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.clock = null;
  vi.useRealTimers();
});
it("locks live acquired access and records source without changing metadata revision", async () => {
  state.rows = [
    [product],
    [["user"]],
    [["ent_a", null]],
    [],
    [["bld_a"]],
    [],
    [[1, 50]],
    [],
    [],
    [
      [
        "cmt_a",
        "Useful resource",
        5,
        "published",
        1,
        "entitlement",
        "2026-10-11T00:00:00Z",
        null,
        "alice",
        "Alice",
      ],
    ],
  ];
  const result = await repo.command(input);
  expect(result).toMatchObject({ id: "cmt_a", revision: 1, ratingCount: 1, ratingAverage: 50 });
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries[1].sql).toContain('from "users"');
  expect(state.queries[2].sql).toContain('from "entitlements"');
  expect(state.queries[2].params).toContain("usr_a");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[4].sql).toContain('"builds"."scanned_at" is not null');
  expect(state.queries.find((q) => q.sql.startsWith('update "products"'))?.sql).not.toContain(
    '"updated_at"',
  );
  expect(state.queries.find((q) => q.sql.startsWith('insert into "comments"'))?.params).toContain(
    "entitlement",
  );
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "audit_events"'))?.params,
  ).not.toContain("Useful resource");
});
it("supports active licenses without converting them into permanent grants", async () => {
  state.rows = [
    [product],
    [["user"]],
    [],
    [["lic_a", null]],
    [],
    [["bld_a"]],
    [],
    [[1, 50]],
    [],
    [],
    [],
  ];
  await repo.command(input);
  expect(state.queries.find((q) => q.sql.startsWith('insert into "comments"'))?.params).toContain(
    "license",
  );
  expect(
    state.queries.some((q) => /^(insert|update).*"(?:licenses|entitlements)"/u.test(q.sql)),
  ).toBe(false);
});
it.each(["publisher", "admin", "organization_owner", "delegated_manager"])(
  "rejects self-interested reviewer %s under locked authority",
  async (role) => {
    if (role === "publisher") state.rows = [[product], [["user"]], [], [["bld_a"]]];
    if (role === "admin") state.rows = [[product], [["admin"]], [], [["bld_a"]]];
    if (role === "organization_owner")
      state.rows = [
        [product.slice(0, 5).concat("org_a")],
        [["usr_a"]],
        [["user"]],
        [],
        [],
        [["bld_a"]],
      ];
    if (role === "delegated_manager")
      state.rows = [
        [product.slice(0, 5).concat("org_a")],
        [["owner"]],
        [["user"]],
        [["member", ["manage_products"]]],
        [],
        [["bld_a"]],
      ];
    const actorId = role === "publisher" ? "usr_publisher" : "usr_a";
    await expect(repo.command({ ...input, actorId })).rejects.toMatchObject({
      code: "REVIEW_ACCESS_REQUIRED",
    });
    expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  },
);
it("rechecks expiry after waiting for build locks", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T00:00:00Z"));
  state.rows = [[product], [["user"]], [["ent_a", "2026-10-11T00:00:01Z"]], [], [["bld_a"]]];
  state.clock = () => {
    if (state.queries.length === 5) vi.setSystemTime(new Date("2026-10-11T00:00:02Z"));
  };
  await expect(repo.command(input)).rejects.toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("stale revision cannot overwrite a newer edit", async () => {
  state.rows = [[product], [["user"]], [["ent_a", null]], [["cmt_a", "published", 2]]];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "REVIEW_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
});
it("moderation removal blocks republishing even with valid access", async () => {
  state.rows = [[product], [["user"]], [["ent_a", null]], [["cmt_a", "removed", 2]]];
  await expect(
    repo.command({ ...input, command: { ...input.command, expectedRevision: 2 } }),
  ).rejects.toMatchObject({ code: "REVIEW_MODERATED" });
});
it("withdrawal remains possible after access expires and excludes the rating", async () => {
  state.rows = [[product], [["user"]], [], [], [["cmt_a", "published", 2]], [], [], [[0, 0]], []];
  expect(
    await repo.command({ ...input, command: { action: "withdraw", expectedRevision: 2 } }),
  ).toMatchObject({ revision: 3, status: "withdrawn", ratingCount: 0 });
  expect(state.queries.find((q) => q.sql.includes("avg("))?.params).toContain("published");
  expect(state.queries.some((q) => q.sql.startsWith('delete from "comments"'))).toBe(false);
});
it("public listing exposes no account IDs or acquisition secrets and paginates in SQL", async () => {
  state.rows = [[product], [["bld_a"]], [[41]], []];
  await repo.publicPage("prd_a", 2);
  const query = state.queries.at(-1);
  if (!query) throw new Error("Missing SQL query");
  expect(query.params).toEqual(["prd_a", "published", 20, 20]);
  expect(query.sql).toContain('"comments"."created_at" desc, "comments"."id" desc');
  const projection = query.sql.split(" from ")[0];
  expect(projection).not.toMatch(
    /email|password|author_id|is_verified_purchase|moderation_reason/u,
  );
});
it("report retries reuse both open and under-review cases without a second audit", async () => {
  state.rows = [[], [product], [["bld_a"]], [["other"]], [["usr_a"]], [["rpt_existing"]]];
  expect(
    await repo.report({ ...input, id: "rpt_a", type: "spam", reason: "Repeated spam text" }),
  ).toEqual({ id: "rpt_existing", created: false });
  expect(state.queries[0].params).toEqual(["report:usr_a:review:cmt_a"]);
  expect(state.queries.at(-1)?.params).toContain("under_review");
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("reporter history is scoped before pagination and never selects staff notes", async () => {
  state.rows = [[[41]], []];
  await repo.reportsPage({ actorId: "usr_a", staff: false }, 2, "history");
  expect(state.queries.at(-1)?.params).toEqual([
    "review",
    "usr_a",
    "resolved",
    "dismissed",
    20,
    20,
  ]);
  expect(state.queries.at(-1)?.sql).not.toContain("moderator_notes");
});
it("staff queues check the current database role, not a session claim", async () => {
  state.rows = [[["user"]]];
  await expect(repo.reportsPage({ actorId: "usr_a", staff: true })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain("for share");
});
it("stale report decisions or edited review evidence cause no writes", async () => {
  state.rows = [
    [["cmt_a", "prd_a"]],
    [product],
    [["cmt_a", "other", 3, "published"]],
    [["open", "cmt_a"]],
    [["moderator"]],
  ];
  await expect(
    repo.decide({
      actorId: "usr_staff",
      id: "rpt_a",
      auditId: "aud_a",
      command: {
        action: "remove_review",
        expectedStatus: "open",
        expectedRevision: 2,
        notes: "Spam review",
      },
    }),
  ).rejects.toMatchObject({ code: "REVIEW_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
});
it("removal, aggregate repair, report resolution and audit share one transaction", async () => {
  state.rows = [
    [["cmt_a", "prd_a"]],
    [product],
    [["cmt_a", "other", 2, "published"]],
    [["open", "cmt_a"]],
    [["moderator"]],
    [],
    [[0, 0]],
    [],
    [],
    [],
  ];
  expect(
    await repo.decide({
      actorId: "usr_staff",
      id: "rpt_a",
      auditId: "aud_a",
      command: {
        action: "remove_review",
        expectedStatus: "open",
        expectedRevision: 2,
        notes: "Spam review",
      },
    }),
  ).toEqual({ id: "rpt_a", status: "resolved", reviewRemoved: true });
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[2].sql).toContain("for update");
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[4].sql).toContain("for share");
  expect(state.queries[5].params).toContain("removed");
  expect(state.queries.at(-1)?.sql).toContain('insert into "audit_events"');
});

it("generic report reads and resolution exclude commercial review cases", async () => {
  const { ReportRepository } = await import("../packages/db/src/repositories/reports");
  const legacy = new ReportRepository();
  state.rows = [[], [], [], [["usr_a"]], [["ses_a", "2099-01-01T00:00:00.000Z"]], []];
  await legacy.countOpen();
  await legacy.listPage("pending", 1);
  await legacy.findById("rpt_a");
  await legacy.resolve("rpt_a", "resolved", "Bypass", {
    id: "aud_a",
    actorId: "usr_a",
    actorType: "admin",
    action: "report.resolved",
    targetId: "rpt_a",
    targetType: "report",
  }, "staff-token");
  expect(state.queries).toHaveLength(6);
  expect(state.queries.some((query) => query.sql.startsWith('update "reports"'))).toBe(true);
  expect(
    state.queries
      .filter((query) => query.sql.includes('"reports"'))
      .every((query) => query.sql.includes(`"reports"."target_type" <> 'review'`)),
  ).toBe(true);
});
