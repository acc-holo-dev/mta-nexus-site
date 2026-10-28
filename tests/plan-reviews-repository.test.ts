import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
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
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { PlanReviewsRepository } from "../packages/db/src/repositories/plan-reviews";

const repo = new PlanReviewsRepository(),
  date = "2026-10-11T00:00:00.000Z";
const terms = {
  titleRu: "Тариф",
  titleEn: "Plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Plan description",
  price: 900,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};
const command = {
  requestId: "11111111-1111-4111-8111-111111111111",
  planId: "cplan_a",
  expectedRevision: 2,
  grossAmount: 10000,
  currency: "RUB" as const,
};
const row = [
  "prev_a",
  "usr_a",
  command.requestId,
  "user",
  "usr_a",
  "cplan_a",
  2,
  10000,
  "RUB",
  terms,
  date,
];
const plan = ["cplan_a", "plan", "user", "published", 2, date, date];
const session = [["ses_current", new Date(Date.now() + 3600000).toISOString()]];
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("records a bounded selection and audit atomically, using database-generated terms", async () => {
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [],
    [plan],
    [[terms, "published"]],
    [],
    session,
    [[0]],
    [row],
    [],
  ];
  const result = await repo.save("usr_a", command, "review-token");
  expect(result).toMatchObject({
    replayed: false,
    review: {
      terms,
      estimate: {
        grossAmount: 10000,
        currency: "RUB",
        platformFee: 750,
        sellerProceeds: 9250,
        initialHoldDays: 7,
        paidCheckoutAvailable: false,
        subscriptionActivationAvailable: false,
      },
    },
  });
  expect(state.queries[5].sql).toContain("for share");
  expect(state.queries[8].sql).toContain('from "sessions"');
  expect(state.queries[8].sql).toContain("for update");
  expect(state.queries[10].sql).toContain('"terms_snapshot"');
  expect(state.queries[10].sql).toContain("default");
  expect(state.queries[11].sql).toContain('insert into "audit_events"');
  expect(state.queries.map((q) => q.sql).join("\n")).not.toMatch(
    /insert into "(?:orders|payments|ledger_entries|licenses|entitlements)"/u,
  );
});
it("an exact retry returns the original receipt even after plan withdrawal, without new writes", async () => {
  state.rows = [[], [], [], [["usr_a"]], [row], session];
  expect(await repo.save("usr_a", command, "review-token")).toMatchObject({
    replayed: true,
    review: { terms },
  });
  expect(state.queries).toHaveLength(6);
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it.each([
  { grossAmount: 10001 },
  { currency: "USD" as const },
  { expectedRevision: 3 },
  { planId: "cplan_b" },
])("rejects key reuse with changed terms %j", async (change) => {
  state.rows = [[], [], [], [["usr_a"]], [row], session];
  await expect(repo.save("usr_a", { ...command, ...change }, "review-token")).rejects.toMatchObject(
    {
      code: "PLAN_REVIEW_CONFLICT",
    },
  );
});
it.each(
  [
    [],
    [[...plan.slice(0, 3), "draft", 2, date, date]],
    [[...plan.slice(0, 2), "organization", "published", 2, date, date]],
    [[...plan.slice(0, 4), 3, date, date]],
  ].map((rows) => ({ rows })),
)("refuses stale/unpublished/wrong-scope plans", async ({ rows }) => {
  state.rows = [[], [], [], [["usr_a"]], [], rows];
  await expect(repo.save("usr_a", command, "review-token")).rejects.toMatchObject({
    code: "PLAN_REVIEW_PLAN_CHANGED",
  });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("checks live financial authority before reading another organization's review", async () => {
  state.rows = [[], [], [["org_a", "usr_other", "Org"]], [["usr_a"]], [["developer"]]];
  await expect(repo.detail("usr_a", "prev_a", "org_a")).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.some((q) => q.sql.includes('from "commercial_plan_reviews"'))).toBe(false);
});
it("refuses a missing live actor before reading a saved request", async () => {
  state.rows = [[], [], [], []];
  await expect(repo.save("usr_a", command, "review-token")).rejects.toMatchObject({
    statusCode: 403,
  });
});
it("caps durable reviews at 500 under the account advisory lock", async () => {
  state.rows = [[], [], [], [["usr_a"]], [], [plan], [[terms, "published"]], [], session, [[500]]];
  await expect(repo.save("usr_a", command, "review-token")).rejects.toMatchObject({
    code: "PLAN_REVIEW_LIMIT",
  });
  expect(state.queries[7].params).toContain("plan-review-account:user:usr_a");
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it.each([2, 3])("compares version %i with the frozen snapshot", async (revision) => {
  state.rows = [
    [],
    [],
    [["usr_a"]],
    [row],
    [[revision, { ...terms, titleEn: "Updated title", privateSecret: "SECRET" }]],
  ];
  const report = await repo.detail("usr_a", "prev_a");
  expect(report.state).toBe(revision === 2 ? "current" : "changed");
  expect(report.review.terms.titleEn).toBe("Plan");
  expect(report.current?.terms.titleEn).toBe("Updated title");
  expect(JSON.stringify(report)).not.toContain("SECRET");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
  expect(state.queries[3].params).toEqual(["prev_a", "user", "usr_a", 1]);
});
it("withdrawn plans preserve saved terms without projecting draft version JSON", async () => {
  state.rows = [[], [], [["usr_a"]], [row], []];
  const report = await repo.detail("usr_a", "prev_a");
  expect(report).toMatchObject({ state: "unavailable", current: null, review: { terms } });
  expect(state.queries[4].params).toContain("published");
});
it("bounds account history by date and stable twenty-record pages", async () => {
  state.rows = [[], [], [["usr_a"]], [[21]], [row]];
  const report = await repo.page("usr_a", undefined, 2, 30);
  expect(report).toMatchObject({ page: 2, pageSize: 20, total: 21 });
  expect(state.queries[4].params.slice(-2)).toEqual([20, 20]);
  expect(state.queries[3].params).toContain("usr_a");
  expect(state.queries[3].params.filter((p) => p instanceof Date)).toHaveLength(2);
});

it("rejects a missing token before opening a transaction", async () => {
  await expect(repo.save("usr_a", command, "")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(state.queries).toHaveLength(0);
});
it("reauthorizes the initiating session before returning an exact replay", async () => {
  state.rows = [[], [], [], [["usr_a"]], [row], []];
  await expect(repo.save("usr_a", command, "revoked-token")).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
