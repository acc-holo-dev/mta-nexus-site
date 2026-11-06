import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for resource-release-watch-resume-repository suites. */
export const resourceReleaseWatchResumeRepositoryState = {
  sessionLive: true,
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceReleaseWatchResumeRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceReleaseWatchResumeRepositoryState;
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

function resetResourceReleaseWatchResumeRepositoryState() {
  resourceReleaseWatchResumeRepositoryState.sessionLive = true;
  resourceReleaseWatchResumeRepositoryState.queries = [];
  resourceReleaseWatchResumeRepositoryState.rows = [];
  resourceReleaseWatchResumeRepositoryState.failAudit = false;
}

export function installResourceReleaseWatchResumeRepositoryHooks() {
  beforeEach(() => {
    resetResourceReleaseWatchResumeRepositoryState();
  });
}

export const resourceReleaseWatchResumeRepositoryStamp = "2026-10-12T00:00:00.000Z";

export const resourceReleaseWatchResumeRepositoryInput = {
  userId: "usr_a",
  currentToken: "tok_a",
  auditId: "aud_a",
  command: {
    items: [
      { productId: "prd_b", expectedRevision: 3 },
      { productId: "prd_a", expectedRevision: 1 },
    ],
  },
};

export function resourceReleaseWatchResumeRepositoryReady(
  previous: unknown[][] = [
    ["prd_a", false, 1, resourceReleaseWatchResumeRepositoryStamp],
    ["prd_b", false, 3, resourceReleaseWatchResumeRepositoryStamp],
  ],
) {
  return [
    [],
    [],
    [],
    [["usr_a"]],
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

export const resourceReleaseWatchResumeRepositoryOutput = [
  {
    productId: "prd_b",
    enabled: true,
    revision: 4,
    updatedAt: resourceReleaseWatchResumeRepositoryStamp,
  },
  {
    productId: "prd_a",
    enabled: true,
    revision: 2,
    updatedAt: resourceReleaseWatchResumeRepositoryStamp,
  },
];

export function resourceReleaseWatchResumeRepositorySuccess() {
  const stamp = resourceReleaseWatchResumeRepositoryStamp;
  const output = resourceReleaseWatchResumeRepositoryOutput;
  resourceReleaseWatchResumeRepositoryState.rows = [
    ...resourceReleaseWatchResumeRepositoryReady(),
    [[4]],
    [{ observedAt: stamp }],
    output,
    [],
  ];
}
