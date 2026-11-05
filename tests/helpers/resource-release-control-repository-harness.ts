/** Shared pg-proxy query capture for resource-release-control repository suites. */
export const resourceReleaseControlRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceReleaseControlRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceReleaseControlRepositoryState;
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

export function resetResourceReleaseControlRepositoryState() {
  const state = resourceReleaseControlRepositoryState;
  state.queries = [];
  state.results = [];
  state.options = [];
}

export const now = new Date("2026-10-10T12:00:00.000Z");
export const stamp = now.toISOString();

export const product = (status = "published", updated = stamp) => [
  "prd_a",
  "PRIVATE TITLE",
  "private-slug",
  status,
  "1.0.0",
  updated,
];

export const fixed = { mode: "fixed" as const, expectedRevision: 0, buildId: "bld_a" };

export const input = {
  currentToken: "raw-buyer-token",
  userId: "usr_a",
  productId: "prd_a",
  command: fixed,
  auditId: "aud_a",
};

export const command = {
  action: "release" as const,
  expectedUpdatedAt: stamp,
  reason: "Reviewed clean evidence",
};

export const modToken = "raw-mod-token";
export const liveSession = [["ses_mod", "2099-01-01T00:00:00.000Z"]];
export const modInput = {
  actorId: "usr_mod",
  productId: "prd_a",
  command,
  auditId: "aud_a",
  currentToken: modToken,
};
export const liveBuyerSession = [["ses_buyer", "2099-01-01T00:00:00.000Z"]];
export const clockRows = [{ observedAt: stamp, sessionCurrent: true }];

export const ownedRows = (status = "published", expiry: string | null = null) => [
  [],
  [["prd_a", "PRIVATE TITLE", "private-slug", status]],
  [["usr_a"]],
  [["ent_a", expiry]],
];
