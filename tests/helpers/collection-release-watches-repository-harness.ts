import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for collection-release-watches-repository suites. */
export const collectionReleaseWatchesRepositoryState = {
  sessionLive: true,
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createCollectionReleaseWatchesRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = collectionReleaseWatchesRepositoryState;
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('from "sessions"'))
      return { rows: state.sessionLive ? [["ses_a", "2099-01-01T00:00:00.000Z"]] : [] };
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failed");
    return { rows: state.rows.shift() ?? [] };
  });
  const db: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown) => callback(db);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db };
}

function resetCollectionReleaseWatchesRepositoryState() {
  const state = collectionReleaseWatchesRepositoryState;
  state.sessionLive = true;
  state.rows = [];
  state.queries = [];
  state.failAudit = false;
}

export function installCollectionReleaseWatchesRepositoryHooks() {
  beforeEach(() => {
    resetCollectionReleaseWatchesRepositoryState();
  });
}

export const collectionReleaseWatchesRepositoryStamp = "2026-10-12T00:00:00.000Z";

export const collectionReleaseWatchesRepositoryInput = {
  userId: "usr_a",
  currentToken: "tok_a",
  collectionId: "lcol_a",
  auditId: "aud_a",
  command: {
    expectedCollectionRevision: 3,
    items: [
      { productId: "prd_a", expectedRevision: 0 },
      { productId: "prd_b", expectedRevision: 2 },
    ],
  },
};

export function collectionReleaseWatchesRepositoryOwned(status = "active", revision = 3) {
  return [[], [], [], [], [["usr_a"]], [["lcol_a", "Core", status, revision]]];
}

export function collectionReleaseWatchesRepositoryReady(
  previous: unknown[][] = [["prd_b", false, 2, collectionReleaseWatchesRepositoryStamp]],
) {
  return [
    ...collectionReleaseWatchesRepositoryOwned(),
    [["prd_a"], ["prd_b"]],
    [
      ["prd_a", "published"],
      ["prd_b", "published"],
    ],
    [["ent_a", null]],
    [["bld_a"]],
    [["ent_b", null]],
    [["bld_b"]],
    previous,
  ];
}

export const collectionReleaseWatchesRepositoryOutput = [
  {
    productId: "prd_b",
    enabled: true,
    revision: 3,
    updatedAt: collectionReleaseWatchesRepositoryStamp,
  },
  {
    productId: "prd_a",
    enabled: true,
    revision: 1,
    updatedAt: collectionReleaseWatchesRepositoryStamp,
  },
];

export function collectionReleaseWatchesRepositorySuccess() {
  const stamp = collectionReleaseWatchesRepositoryStamp;
  collectionReleaseWatchesRepositoryState.rows = [
    ...collectionReleaseWatchesRepositoryReady(),
    [[5]],
    [{ observedAt: stamp }],
    collectionReleaseWatchesRepositoryOutput,
    [],
  ];
}
