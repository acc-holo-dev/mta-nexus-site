import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessions, users } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  fail: false,
}));

vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    db: drizzle(async (sql, params) => {
      state.queries.push({ sql, params });
      if (state.fail) throw new Error("Database unavailable");
      return { rows: state.rows };
    }),
  };
});
vi.mock("@nexus/db", async () => ({
  sessionRepository: (await import("../packages/db/src/repositories/sessions")).sessionRepository,
}));

import { authService } from "../apps/web/src/lib/services/auth-service";

const NOW = new Date("2026-10-09T09:00:00Z");
const token = "raw-session-token";
const storedToken = createHash("sha256").update(token).digest("hex");

function joinedRow(expiresAt: Date, id = "usr_1", sessionId = "ses_1") {
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
    ...Object.keys(getTableColumns(sessions)).map(
      (key) => session[key as keyof typeof session] ?? null,
    ),
    ...Object.keys(getTableColumns(users)).map((key) => user[key as keyof typeof user] ?? null),
  ];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.rows = [];
  state.queries = [];
  state.fail = false;
});
afterEach(() => vi.useRealTimers());

describe("authenticated session identity", () => {
  it("returns a sanitized user and session ID from one real Drizzle query", async () => {
    state.rows = [joinedRow(new Date(NOW.getTime() + 1))];
    const identity = await authService.getSessionIdentity(token);
    expect(identity).toMatchObject({ user: { id: "usr_1" }, sessionId: "ses_1" });
    expect(Object.keys(identity ?? {})).toEqual(["user", "sessionId"]);
    const serialized = JSON.stringify(identity);
    for (const secret of [
      token,
      storedToken,
      "private-password-hash",
      "Private Browser",
      "203.0.113.10",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0]?.sql).toContain('inner join "users"');
    expect(state.queries[0]?.params).toEqual([storedToken, 1]);
  });

  it.each([undefined, null, ""])("avoids database reads without a token (%s)", async (missing) => {
    await expect(authService.getSessionIdentity(missing)).resolves.toBeNull();
    expect(state.queries).toHaveLength(0);
  });

  it("fails closed for a missing or revoked session", async () => {
    await expect(authService.getSessionIdentity(token)).resolves.toBeNull();
    expect(state.queries).toHaveLength(1);
  });

  it("propagates lookup errors instead of returning an authenticated identity", async () => {
    state.fail = true;
    await expect(authService.getSessionIdentity(token)).rejects.toThrow();
    expect(state.queries).toHaveLength(1);
  });

  it.each([-1, 0])(
    "rejects a session expired at or before the current time (%s ms)",
    async (offset) => {
      state.rows = [joinedRow(new Date(NOW.getTime() + offset))];
      await expect(authService.getSessionIdentity(token)).resolves.toBeNull();
      expect(state.queries).toHaveLength(1);
    },
  );

  it("does not cache identity across requests or reuse a revoked session", async () => {
    state.rows = [joinedRow(new Date(NOW.getTime() + 1000))];
    expect((await authService.getSessionIdentity(token))?.user.id).toBe("usr_1");
    state.rows = [];
    await expect(authService.getSessionIdentity(token)).resolves.toBeNull();
    state.rows = [joinedRow(new Date(NOW.getTime() + 1000), "usr_2", "ses_2")];
    expect(await authService.getSessionIdentity("second-token")).toMatchObject({
      user: { id: "usr_2" },
      sessionId: "ses_2",
    });
    expect(state.queries).toHaveLength(3);
    expect(state.queries[2]?.params[0]).toBe(
      createHash("sha256").update("second-token").digest("hex"),
    );
  });
});
