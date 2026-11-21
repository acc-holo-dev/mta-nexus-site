import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
}));

vi.mock("../../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
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

import { WalletTopupRepository } from "../../packages/db/src/repositories/wallet-topup";
import { walletTopupIntents } from "../../packages/db/src/schema";

const repo = new WalletTopupRepository();
const columns = Object.keys(getTableColumns(walletTopupIntents));

function row(patch: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = {
    id: "pay_topup_1",
    accountId: "user:usr_buyer",
    amount: 250,
    currency: "EUR",
    providerId: "stub",
    status: "awaiting_provider",
    idempotencyKey: "idem_topup_repo_1",
    providerSessionId: "stub_sess_pay_topup_1",
    providerEventId: null,
    ledgerBatchId: null,
    returnPath: "/workspace/finance",
    createdAt: new Date("2026-11-21T02:00:00.000Z"),
    updatedAt: new Date("2026-11-21T02:00:00.000Z"),
    ...patch,
  };
  return columns.map((key) => value[key]);
}

beforeEach(() => {
  state.queries = [];
  state.results = [];
});

it("inserts an awaiting top-up intent", async () => {
  state.results = [[row()]];
  const intent = await repo.insertAwaiting({
    intent: {
      id: "pay_topup_1",
      accountId: "user:usr_buyer",
      amount: 250,
      currency: "EUR",
      providerId: "stub",
      status: "awaiting_provider",
      idempotencyKey: "idem_topup_repo_1",
      providerSessionId: "stub_sess_pay_topup_1",
      createdAt: "2026-11-21T02:00:00.000Z",
    },
    returnPath: "/workspace/finance",
  });
  expect(intent.status).toBe("awaiting_provider");
  expect(state.queries[0].sql).toContain('insert into "wallet_topup_intents"');
});

it("marks succeeded with ledger batch and provider event", async () => {
  state.results = [
    [],
    [row()],
    [
      row({
        status: "succeeded",
        providerEventId: "stub_evt_1",
        ledgerBatchId: "topup_pay_topup_1",
      }),
    ],
  ];
  const intent = await repo.markSucceeded({
    intentId: "pay_topup_1",
    providerEventId: "stub_evt_1",
    ledgerBatchId: "topup_pay_topup_1",
  });
  expect(intent.status).toBe("succeeded");
  expect(state.queries.some((query) => query.sql.includes("for update"))).toBe(true);
  expect(state.queries.some((query) => query.params.includes("wallet-topup:pay_topup_1"))).toBe(
    true,
  );
});

it("exact succeeded replay is idempotent", async () => {
  state.results = [
    [],
    [
      row({
        status: "succeeded",
        providerEventId: "stub_evt_1",
        ledgerBatchId: "topup_pay_topup_1",
      }),
    ],
  ];
  const intent = await repo.markSucceeded({
    intentId: "pay_topup_1",
    providerEventId: "stub_evt_1",
    ledgerBatchId: "topup_pay_topup_1",
  });
  expect(intent.status).toBe("succeeded");
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
});

it("marks failed without touching a succeeded intent", async () => {
  state.results = [
    [],
    [
      row({
        status: "succeeded",
        providerEventId: "stub_evt_ok",
        ledgerBatchId: "topup_pay_topup_1",
      }),
    ],
  ];
  await expect(repo.markFailed("pay_topup_1", "stub_evt_fail")).rejects.toMatchObject({
    code: "TOPUP_INTENT_STATE",
  });
});

it("lists recent top-ups for an account newest first", async () => {
  state.results = [
    [
      row({
        id: "pay_topup_2",
        idempotencyKey: "idem_topup_repo_2",
        createdAt: new Date("2026-11-21T03:00:00.000Z"),
      }),
      row(),
    ],
  ];
  const intents = await repo.listRecentByAccount("user:usr_buyer", 20);
  expect(intents.map((intent) => intent.id)).toEqual(["pay_topup_2", "pay_topup_1"]);
  expect(state.queries[0].sql).toContain('from "wallet_topup_intents"');
  expect(state.queries[0].sql).toContain("order by");
});

it("cancels an awaiting top-up without ledger posting", async () => {
  state.results = [[], [row()], [row({ status: "cancelled" })]];
  const intent = await repo.cancelAwaiting({
    intentId: "pay_topup_1",
    accountId: "user:usr_buyer",
  });
  expect(intent.status).toBe("cancelled");
  expect(state.queries.some((query) => query.sql.includes("for update"))).toBe(true);
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(true);
});

it("rejects cancel for a succeeded top-up", async () => {
  state.results = [[], [row({ status: "succeeded", providerEventId: "stub_evt_ok" })]];
  await expect(
    repo.cancelAwaiting({ intentId: "pay_topup_1", accountId: "user:usr_buyer" }),
  ).rejects.toMatchObject({ code: "TOPUP_INTENT_STATE" });
});
