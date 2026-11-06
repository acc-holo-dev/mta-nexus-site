import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReviewRepositoryDbMock } = await import(
    "./helpers/resource-review-repository-harness"
  );
  return createResourceReviewRepositoryDbMock();
});

import { resourceReviewsRepository as repo } from "../packages/db/src/repositories/resource-reviews";
import {
  installResourceReviewRepositoryHooks,
  resourceReviewRepositoryInput as input,
  resourceReviewRepositoryProduct as product,
  resourceReviewRepositoryState as state,
} from "./helpers/resource-review-repository-harness";

installResourceReviewRepositoryHooks();

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
  state.rows = [[], [], [], [["moderator"]], [], [["ses_a", "2099-01-01T00:00:00.000Z"]], []];
  await legacy.countOpen();
  await legacy.listPage("pending", 1);
  await legacy.findById("rpt_a");
  await legacy.resolve(
    "rpt_a",
    "resolved",
    "Bypass",
    {
      id: "aud_a",
      actorId: "usr_a",
      actorType: "admin",
      action: "report.resolved",
      targetId: "rpt_a",
      targetType: "report",
    },
    "staff-token",
  );
  expect(state.queries).toHaveLength(7);
  expect(state.queries.some((query) => query.sql.startsWith('update "reports"'))).toBe(true);
  expect(
    state.queries
      .filter((query) => query.sql.includes('"reports"'))
      .every((query) => query.sql.includes(`"reports"."target_type" <> 'review'`)),
  ).toBe(true);
});
