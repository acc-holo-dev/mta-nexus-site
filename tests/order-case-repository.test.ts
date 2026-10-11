import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  notice: vi.fn(),
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
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
vi.mock("../packages/db/src/repositories/support-requester-notice", () => ({
  supportRequesterNotice: state.notice,
}));
import { orderCasesRepository as repo } from "../packages/db/src/repositories/order-cases";
const date = "2026-10-11T00:00:00.000Z",
  nextDate = "2026-10-11T00:00:00.001Z";
const order = ["ord_a", "NEXUS-1", "completed", 1200, "USD", date];
const snapshotHash = createHash("sha256")
  .update(
    JSON.stringify([
      "ord_a",
      "NEXUS-1",
      "completed",
      1200,
      "USD",
      2,
      1,
      1,
      1,
      0,
      0,
      [[createHash("sha256").update("pay_a").digest("hex"), "completed", 1200, "USD", date, date]],
    ]),
  )
  .digest("hex");
const requestId = "00000000-0000-4000-8000-000000000000";
const draft = {
  requestId,
  kind: "refund_request" as const,
  subject: "Refund request",
  message: "Please investigate this order",
  requestedAmount: 600,
};
const create = {
  orderId: "ord_a",
  actorId: "usr_buyer",
  caseId: "sup_a",
  messageId: "spm_a",
  auditId: "aud_a",
  command: draft,
};
const review = {
  caseId: "sup_a",
  actorId: "usr_staff",
  auditId: "aud_r",
  statusAuditId: "aud_s",
  messageId: "spm_s",
  command: {
    action: "recommend_refund" as const,
    expectedRevision: 2,
    expectedSupportUpdatedAt: date,
    expectedEvidenceHash: snapshotHash,
    notes: "Recommend for provider reconciliation",
  },
};
function reviewRows(
  role = "admin",
  currentRevision = 2,
  timestamp = date,
  summary = [1, 1, 1, 0, 0],
) {
  return [
    [["ord_a"]],
    [[...order, "usr_buyer"]],
    [["usr_staff", role]],
    [["open", timestamp, "usr_buyer"]],
    [["refund_request", "reviewing", currentRevision, 600, "USD"]],
    [summary],
    [[2]],
    [["pay_a", "completed", 1200, "USD", date, date]],
  ];
}
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.notice.mockReset().mockResolvedValue(undefined);
});
it("locks the buyer's order and atomically claims intake, context, message and audit", async () => {
  state.rows = [
    [],
    [order],
    [["usr_buyer", "user"]],
    [],
    [],
    [[1, 1, 1, 0, 0]],
    [[2]],
    [["pay_a", "completed", 1200, "USD", date, date]],
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
