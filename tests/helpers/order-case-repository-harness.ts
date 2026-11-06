import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for order-case-repository suites. */
export const orderCaseRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  notice: vi.fn(),
  session: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createOrderCaseRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = orderCaseRepositoryState;
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
}

function resetOrderCaseRepositoryState() {
  const state = orderCaseRepositoryState;
  state.rows = [];
  state.queries = [];
  state.notice.mockReset().mockResolvedValue(undefined);
  state.session.mockReset();
}

export function installOrderCaseRepositoryHooks() {
  beforeEach(() => {
    resetOrderCaseRepositoryState();
  });
}

export const orderCaseRepositoryDate = "2026-10-11T00:00:00.000Z";
export const orderCaseRepositoryNextDate = "2026-10-11T00:00:00.001Z";

export const orderCaseRepositoryOrder = [
  "ord_a",
  "NEXUS-1",
  "completed",
  1200,
  "USD",
  orderCaseRepositoryDate,
];

const orderCaseRepositorySnapshotHash = createHash("sha256")
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
      [
        [
          createHash("sha256").update("pay_a").digest("hex"),
          "completed",
          1200,
          "USD",
          orderCaseRepositoryDate,
          orderCaseRepositoryDate,
        ],
      ],
    ]),
  )
  .digest("hex");

export const orderCaseRepositoryRequestId = "00000000-0000-4000-8000-000000000000";

export const orderCaseRepositoryDraft = {
  requestId: orderCaseRepositoryRequestId,
  kind: "refund_request" as const,
  subject: "Refund request",
  message: "Please investigate this order",
  requestedAmount: 600,
};

export const orderCaseRepositoryCreate = {
  orderId: "ord_a",
  actorId: "usr_buyer",
  caseId: "sup_a",
  messageId: "spm_a",
  auditId: "aud_a",
  command: orderCaseRepositoryDraft,
};

export const orderCaseRepositoryReview = {
  caseId: "sup_a",
  actorId: "usr_staff",
  currentToken: "staff-token",
  auditId: "aud_r",
  statusAuditId: "aud_s",
  messageId: "spm_s",
  command: {
    action: "recommend_refund" as const,
    expectedRevision: 2,
    expectedSupportUpdatedAt: orderCaseRepositoryDate,
    expectedEvidenceHash: orderCaseRepositorySnapshotHash,
    notes: "Recommend for provider reconciliation",
  },
};

export function orderCaseRepositoryReviewRows(
  role = "admin",
  currentRevision = 2,
  timestamp = orderCaseRepositoryDate,
  summary = [1, 1, 1, 0, 0],
) {
  const date = orderCaseRepositoryDate;
  const order = orderCaseRepositoryOrder;
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
