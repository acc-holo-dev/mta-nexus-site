import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createOrderCaseRepositoryDbMock } = await import(
    "./helpers/order-case-repository-harness"
  );
  return createOrderCaseRepositoryDbMock();
});
vi.mock("../packages/db/src/repositories/initiating-session", async () => {
  const { orderCaseRepositoryState } = await import("./helpers/order-case-repository-harness");
  return { lockInitiatingSession: orderCaseRepositoryState.session };
});
vi.mock("../packages/db/src/repositories/support-requester-notice", async () => {
  const { orderCaseRepositoryState } = await import("./helpers/order-case-repository-harness");
  return { supportRequesterNotice: orderCaseRepositoryState.notice };
});

import { orderCasesRepository as repo } from "../packages/db/src/repositories/order-cases";
import {
  installOrderCaseRepositoryHooks,
  orderCaseRepositoryDate as date,
  orderCaseRepositoryNextDate as nextDate,
  orderCaseRepositoryOrder as order,
  orderCaseRepositoryReview as review,
  orderCaseRepositoryReviewRows as reviewRows,
  orderCaseRepositoryState as state,
} from "./helpers/order-case-repository-harness";

installOrderCaseRepositoryHooks();

it.each([
  [3, date],
  [2, nextDate],
])(
  "rejects stale case or conversation observations before review writes",
  async (revision, timestamp) => {
    state.rows = reviewRows("admin", revision as number, timestamp as string);
    await expect(repo.review(review)).rejects.toMatchObject({
      code: "ORDER_CASE_REVISION_CONFLICT",
    });
    expect(state.queries).toHaveLength(5);
  },
);

it("rejects changed recorded evidence without any mutation", async () => {
  state.rows = reviewRows("admin", 2, date, [2, 1, 1, 0, 0]);
  await expect(repo.review(review)).rejects.toMatchObject({ code: "ORDER_CASE_EVIDENCE_CHANGED" });
  expect(state.queries).toHaveLength(8);
});

it("requires current admin authority for a refund recommendation", async () => {
  state.rows = reviewRows("moderator");
  await expect(repo.review(review)).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.every((q) => !q.sql.startsWith("update"))).toBe(true);
});

it("blocks even an administrator from reviewing their own order", async () => {
  state.rows = [[["ord_a"]], [[...order, "usr_staff"]], [["usr_staff", "admin"]]];
  await expect(repo.review(review)).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(3);
});

it("saves a non-financial recommendation, keeps the conversation open and notifies atomically", async () => {
  state.rows = [...reviewRows(), [[3]], [["sup_a", "usr_buyer", nextDate]], [], []];
  expect(await repo.review(review)).toMatchObject({
    financialExecution: false,
    reviewStatus: "refund_recommended",
    threadStatus: "open",
    revision: 3,
  });
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[8].sql).toContain('"commerce_order_cases"."revision" =');
  expect(state.queries[9].sql).toContain("interval '1 millisecond'");
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: "sup_a", requesterId: "usr_buyer" }),
    "reply",
    "aud_r",
  );
  expect(
    state.queries
      .filter((q) => /^(update|insert)/u.test(q.sql))
      .every((q) => !/"(orders|payments|ledger_entries|licenses|entitlements)"/u.test(q.sql)),
  ).toBe(true);
});

it("propagates notification failure so the transaction can roll back", async () => {
  state.rows = [...reviewRows(), [[3]], [["sup_a", "usr_buyer", nextDate]], [], []];
  state.notice.mockRejectedValue(Error("notification rollback"));
  await expect(repo.review(review)).rejects.toThrow("notification rollback");
});

it("rechecks live staff role before returning the staff queue", async () => {
  state.rows = [[["usr_staff", "user"]]];
  await expect(repo.page("usr_staff", true)).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(1);
});

it("keeps buyer archive scoped even for privileged users", async () => {
  state.rows = [[["usr_staff", "admin"]], [[0]], []];
  await repo.page("usr_staff", false);
  expect(state.queries[1].params).toEqual(["usr_staff"]);
  expect(state.queries[2].params).toEqual(["usr_staff", 20]);
});
