import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, vi } from "vitest";
import { sessions, users } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for auth-session-identity suites. */
export const authSessionIdentityState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  fail: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createAuthSessionIdentityDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = authSessionIdentityState;
  return {
    db: drizzle(async (sql, params) => {
      state.queries.push({ sql, params });
      if (state.fail) throw new Error("Database unavailable");
      return { rows: state.rows };
    }),
  };
}

export const authSessionIdentityNow = new Date("2026-10-09T09:00:00Z");
export const authSessionIdentityToken = "raw-session-token";
export const authSessionIdentityStoredToken = createHash("sha256")
  .update(authSessionIdentityToken)
  .digest("hex");

export function authSessionIdentityJoinedRow(
  expiresAt: Date,
  id = "usr_1",
  sessionId = "ses_1",
  fullSession = false,
) {
  const NOW = authSessionIdentityNow;
  const storedToken = authSessionIdentityStoredToken;
  const session = {
    id: sessionId,
    userId: id,
    token: storedToken,
    expiresAt: expiresAt.toISOString(),
    createdAt: NOW.toISOString(),
    ipAddress: "203.0.113.10",
    userAgent: "Private Browser",
  };
  const user = {
    id,
    email: "user@example.test",
    username: id,
    displayName: "Account",
    passwordHash: "private-password-hash",
    role: "user",
    isVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
  return [
    ...(fullSession
      ? Object.keys(getTableColumns(sessions)).map(
          (key) => session[key as keyof typeof session] ?? null,
        )
      : [sessionId, expiresAt.toISOString()]),
    ...Object.keys(getTableColumns(users))
      .filter((key) => key !== "passwordHash")
      .map((key) => user[key as keyof typeof user] ?? null),
  ];
}

function resetAuthSessionIdentityState() {
  const state = authSessionIdentityState;
  vi.useFakeTimers();
  vi.setSystemTime(authSessionIdentityNow);
  state.rows = [];
  state.queries = [];
  state.fail = false;
}

export function installAuthSessionIdentityHooks() {
  beforeEach(() => {
    resetAuthSessionIdentityState();
  });
  afterEach(() => vi.useRealTimers());
}
