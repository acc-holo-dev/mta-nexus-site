import { createHash } from "node:crypto";
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
  orderCaseRepositoryCreate as create,
  orderCaseRepositoryDraft as draft,
  orderCaseRepositoryOrder as order,
  orderCaseRepositoryRequestId as requestId,
  orderCaseRepositoryState as state,
} from "./helpers/order-case-repository-harness";

installOrderCaseRepositoryHooks();

it("locks the buyer's order and atomically claims intake, context, message and audit", async () => {
  state.rows = [
    [],
    [order],
    [["usr_buyer", "user"]],
    [],
    [],
    [[1, 1, 1, 0, 0]],
    [[2]],
    [["pay_a", "completed", 1200, "USD", "2026-10-11T00:00:00.000Z", "2026-10-11T00:00:00.000Z"]],
    [[requestId]],
    [],
    [],
    [],
    [],
  ];
  expect(await repo.create(create)).toMatchObject({
    kind: "order_case_created",
    caseId: "sup_a",
    replayed: false,
  });
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[1].params).toContain("usr_buyer");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[8].sql).toContain("on conflict do nothing");
  expect(state.queries.slice(8).map((q) => q.sql.match(/insert into "([^"]+)"/u)?.[1])).toEqual([
    "support_mutation_requests",
    "support_cases",
    "commerce_order_cases",
    "support_case_messages",
    "audit_events",
  ]);
  const snapshot = state.queries
    .find((q) => q.sql.startsWith('insert into "commerce_order_cases"'))
    ?.params.find((p) => typeof p === "string" && p.startsWith('{"orderId"'));
  expect(JSON.parse(snapshot as string)).toMatchObject({
    confirmation: "recorded_only",
    recordedMatchingCaptureCount: 1,
  });
  expect(state.queries.every((q) => !/transaction_id|failure_reason|provider/u.test(q.sql))).toBe(
    true,
  );
});

it("never reads another buyer's order or writes intake when the scoped order is absent", async () => {
  state.rows = [[], []];
  await expect(repo.create(create)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries[1].params).toEqual(["ord_a", "usr_buyer", 1]);
  expect(state.queries).toHaveLength(2);
});

it("rejects an existing case without adding the new message", async () => {
  state.rows = [[], [order], [["usr_buyer", "user"]], [], [["sup_existing"]]];
  await expect(repo.create(create)).rejects.toMatchObject({ code: "ORDER_CASE_EXISTS" });
  expect(state.queries.every((q) => !q.sql.startsWith("insert"))).toBe(true);
});

it("rejects a mismatched idempotency receipt before writes", async () => {
  state.rows = [[], [order], [["usr_buyer", "user"]], [["b".repeat(64), "case", "sup_a"]]];
  await expect(repo.create(create)).rejects.toMatchObject({ code: "ORDER_CASE_REQUEST_CONFLICT" });
  expect(state.queries).toHaveLength(4);
});

it("replays the exact saved request even after its conversation changes", async () => {
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        "order-case",
        "ord_a",
        draft.kind,
        draft.subject,
        draft.message,
        draft.requestedAmount,
      ]),
    )
    .digest("hex");
  state.rows = [[], [order], [["usr_buyer", "user"]], [[hash, "case", "sup_a"]], [["sup_a"]]];
  expect(await repo.create(create)).toMatchObject({ replayed: true, caseId: "sup_a", requestId });
  expect(state.queries).toHaveLength(5);
});
