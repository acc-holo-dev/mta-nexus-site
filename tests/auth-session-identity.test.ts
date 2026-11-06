import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createAuthSessionIdentityDbMock } = await import("./helpers/auth-session-identity-harness");
  return createAuthSessionIdentityDbMock();
});
vi.mock("@nexus/db", async () => ({
  sessionRepository: (await import("../packages/db/src/repositories/sessions")).sessionRepository,
}));

import { authService } from "../apps/web/src/lib/services/auth-service";
import {
  authSessionIdentityJoinedRow as joinedRow,
  authSessionIdentityNow as NOW,
  authSessionIdentityState as state,
  authSessionIdentityStoredToken as storedToken,
  authSessionIdentityToken as token,
  installAuthSessionIdentityHooks,
} from "./helpers/auth-session-identity-harness";

installAuthSessionIdentityHooks();

it("returns a sanitized user and session ID from one real Drizzle query", async () => {
  state.rows = [joinedRow(new Date(NOW.getTime() + 1))];
  const identity = await authService.getSessionIdentity(token);
  expect(identity).toMatchObject({
    user: {
      id: "usr_1",
      role: "user",
      isVerified: false,
      emailVerified: false,
      twoFactorEnabled: false,
    },
    sessionId: "ses_1",
  });
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
  expect(state.queries[0]?.sql).not.toContain('"password_hash"');
  const selection = state.queries[0].sql.split(" from ")[0];
  for (const column of [
    '"sessions"."token"',
    '"sessions"."ip_address"',
    '"sessions"."user_agent"',
    '"sessions"."user_id"',
    '"sessions"."created_at"',
  ]) {
    expect(selection).not.toContain(column);
  }
  expect(selection).toContain('"sessions"."id"');
  expect(selection).toContain('"sessions"."expires_at"');
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

it.each(["not-a-date", "infinity", "-infinity"])(
  "fails closed for malformed or non-finite identity expiry %s",
  async (value) => {
    const row = joinedRow(new Date(NOW.getTime() + 1000));
    row[1] = value;
    state.rows = [row];
    expect(await authService.getSessionIdentity(token)).toBeNull();
  },
);
