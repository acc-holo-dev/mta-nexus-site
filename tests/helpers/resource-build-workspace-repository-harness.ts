import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for resource-build-workspace-repository suites. */
export const resourceBuildWorkspaceRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceBuildWorkspaceRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceBuildWorkspaceRepositoryState;
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

export function resetResourceBuildWorkspaceRepositoryState() {
  resourceBuildWorkspaceRepositoryState.queries = [];
  resourceBuildWorkspaceRepositoryState.rows = [];
}

export function installResourceBuildWorkspaceRepositoryHooks() {
  beforeEach(() => {
    resetResourceBuildWorkspaceRepositoryState();
  });
}

export const resourceBuildWorkspaceRepositoryParent = [
  "prd_a",
  "Resource",
  "resource",
  "published",
  "usr_a",
  null,
];

export function resourceBuildWorkspaceRepositoryBuild(
  status = "pending_review",
  revision = 3,
  notes: string | null = null,
) {
  return [
    "bld_a",
    "prd_a",
    "1.0.0",
    status,
    revision,
    notes,
    null,
    "resource.zip",
    42,
    "a".repeat(64),
    "clean",
    "scanner",
    "2026-10-11T00:00:00Z",
    false,
    "2026-10-11T00:00:00Z",
  ];
}

export const resourceBuildWorkspaceRepositoryInput = {
  productId: "prd_a",
  buildId: "bld_a",
  actorId: "usr_a",
  auditId: "aud_a",
  command: { action: "withdraw" as const, expectedRevision: 3, reason: "Correct notes" },
};
