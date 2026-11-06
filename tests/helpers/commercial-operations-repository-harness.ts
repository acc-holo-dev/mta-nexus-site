import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { commercialPlans } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for commercial-operations-repository suites. */
export const commercialOperationsRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createCommercialOperationsRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    commercialOperationsRepositoryState.queries.push({ sql, params });
    return { rows: commercialOperationsRepositoryState.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            commercialOperationsRepositoryState.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetCommercialOperationsRepositoryState() {
  commercialOperationsRepositoryState.queries = [];
  commercialOperationsRepositoryState.results = [];
  commercialOperationsRepositoryState.options = [];
}

export function installCommercialOperationsRepositoryHooks() {
  beforeEach(() => {
    resetCommercialOperationsRepositoryState();
  });
}

export const commercialOperationsRepositoryNow = "2026-10-10T12:00:00.000Z";
export const commercialOperationsRepositoryCancelled = "2026-10-10T12:00:00.001Z";

export const commercialOperationsRepositoryTerms = {
  titleRu: "Тариф",
  titleEn: "Seller plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Published plan terms",
  price: 999,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};

export const commercialOperationsRepositoryCommand = {
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  expectedUpdatedAt: commercialOperationsRepositoryNow,
  reason: "No longer needed",
};

export const commercialOperationsRepositoryInput = {
  buyerId: "usr_buyer",
  currentToken: "buyer-token",
  orderId: "ord_a",
  command: commercialOperationsRepositoryCommand,
  auditId: "aud_a",
};

export const commercialOperationsRepositoryBuyerAuthorization = [
  [["usr_buyer"]],
  [["ses_buyer", "2099-01-01T00:00:00.000Z"]],
];

export function commercialOperationsRepositoryRoot(status = "draft", revision = 2) {
  const record: Record<string, unknown> = {
    id: "cplan_a",
    slug: "seller-plan",
    scope: "user",
    status,
    revision,
    updatedAt: commercialOperationsRepositoryNow,
    createdAt: commercialOperationsRepositoryNow,
  };
  return Object.keys(getTableColumns(commercialPlans)).map((key) => record[key]);
}
