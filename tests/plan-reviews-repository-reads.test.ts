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
  planReviewsRepositoryRow as row,
  planReviewsRepositoryState as state,
  planReviewsRepositoryTerms as terms,
} from "./helpers/plan-reviews-repository-harness";

const repo = new PlanReviewsRepository();

installPlanReviewsRepositoryHooks();

it("checks live financial authority before reading another organization's review", async () => {
  state.rows = [[], [], [["org_a", "usr_other", "Org"]], [["usr_a"]], [["developer"]]];
  await expect(repo.detail("usr_a", "prev_a", "org_a")).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.some((q) => q.sql.includes('from "commercial_plan_reviews"'))).toBe(false);
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
