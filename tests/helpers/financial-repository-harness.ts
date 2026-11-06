import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { ledgerEntries } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for financial-repository suites. */
export const financialRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createFinancialRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = financialRepositoryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetFinancialRepositoryState() {
  financialRepositoryState.queries = [];
  financialRepositoryState.results = [];
  financialRepositoryState.options = [];
}

export function installFinancialRepositoryHooks() {
  beforeEach(() => {
    resetFinancialRepositoryState();
  });
}

export const financialRepositoryLines = [
  {
    id: "leg_a",
    accountId: "user:usr_a",
    amount: 90,
    currency: "USD",
    referenceType: "fee" as const,
    referenceId: "ref_a",
    description: "Credit",
  },
  {
    id: "leg_b",
    accountId: "platform:nexus",
    amount: -90,
    currency: "USD",
    referenceType: "fee" as const,
    referenceId: "ref_a",
    description: "Debit",
  },
];

export function financialRepositoryRecord(
  line: (typeof financialRepositoryLines)[number],
  balanceAfter: number,
) {
  const value: Record<string, unknown> = {
    ...line,
    batchId: "post_a",
    balanceAfter,
    createdAt: "2026-10-11T00:00:00.000Z",
  };
  return Object.keys(getTableColumns(ledgerEntries)).map((key) => value[key]);
}

export function financialRepositoryDigest(lines = financialRepositoryLines) {
  return createHash("sha256").update(JSON.stringify(lines)).digest("hex");
}
