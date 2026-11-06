import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, vi } from "vitest";
import { users } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for public-user-projection suites. */
export const publicUserProjectionState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  failure: null as Error | null,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createPublicUserProjectionDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    publicUserProjectionState.queries.push({ sql, params });
    if (publicUserProjectionState.failure) throw publicUserProjectionState.failure;
    return { rows: publicUserProjectionState.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        // SQL/row mapping only; these tests do not model PostgreSQL locking or rollback.
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetPublicUserProjectionState() {
  publicUserProjectionState.queries = [];
  publicUserProjectionState.results = [];
  publicUserProjectionState.failure = null;
}

export const publicUserProjectionNow = new Date("2026-10-09T10:15:00Z");

export const publicUserProjectionFixture = {
  id: "user-1",
  email: "user@example.test",
  username: "account",
  displayName: "Account",
  passwordHash: "stored-credential",
  role: "developer",
  bio: "Developer biography",
  avatarUrl: null,
  isVerified: true,
  emailVerified: false,
  twoFactorEnabled: true,
  activeContextId: "personal",
  createdAt: publicUserProjectionNow.toISOString(),
  updatedAt: publicUserProjectionNow.toISOString(),
};

export function publicUserProjectionRow(
  overrides: Partial<typeof publicUserProjectionFixture> = {},
  credential = false,
) {
  const values = { ...publicUserProjectionFixture, ...overrides };
  return Object.keys(getTableColumns(users))
    .filter((key) => credential || key !== "passwordHash")
    .map((key) => values[key as keyof typeof values] ?? null);
}

export const publicUserProjectionExpected = {
  id: "user-1",
  email: "user@example.test",
  username: "account",
  displayName: "Account",
  role: "developer",
  bio: "Developer biography",
  isVerified: true,
  emailVerified: false,
  twoFactorEnabled: true,
  activeContextId: "personal",
  createdAt: publicUserProjectionNow,
  updatedAt: publicUserProjectionNow,
};

export const publicUserProjectionSession = {
  id: "session",
  userId: "user-1",
  token: "raw-token",
  expiresAt: new Date(publicUserProjectionNow.getTime() + 1000),
};

export const publicUserProjectionTokenDigest = createHash("sha256")
  .update("raw-token")
  .digest("hex");

export function publicUserProjectionLiveSession(
  expiresAt = new Date(publicUserProjectionNow.getTime() + 60_000),
) {
  return ["ses_1", expiresAt.toISOString()];
}

export const publicUserProjectionAudit = {
  id: "audit",
  actorId: "user-1",
  actorType: "user" as const,
  action: "user.registered",
  targetId: "user-1",
  targetType: "user",
};

export function installPublicUserProjectionHooks() {
  beforeEach(() => {
    resetPublicUserProjectionState();
    vi.useFakeTimers();
    vi.setSystemTime(publicUserProjectionNow);
  });
  afterEach(() => vi.useRealTimers());
}
