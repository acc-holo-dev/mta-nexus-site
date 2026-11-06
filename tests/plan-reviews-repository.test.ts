import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createPlanReviewsRepositoryDbMock } = await import(
    "./helpers/plan-reviews-repository-harness"
  );
  return createPlanReviewsRepositoryDbMock();
});

import { PlanReviewsRepository } from "../packages/db/src/repositories/plan-reviews";
import {
  installPlanReviewsRepositoryHooks,
  planReviewsRepositoryCommand as command,
  planReviewsRepositoryDate as date,
  planReviewsRepositoryPlan as plan,
  planReviewsRepositoryRow as row,
  planReviewsRepositorySession as session,
  planReviewsRepositoryState as state,
  planReviewsRepositoryTerms as terms,
} from "./helpers/plan-reviews-repository-harness";

const repo = new PlanReviewsRepository();

installPlanReviewsRepositoryHooks();

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
    session,
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
  expect(state.queries[12].sql).toContain('from "sessions"');
  expect(state.queries[12].sql).toContain("for update");
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
