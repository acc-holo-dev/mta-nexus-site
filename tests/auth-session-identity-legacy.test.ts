import { getTableColumns } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { sessions } from "../packages/db/src/schema";

vi.mock("../packages/db/src/client", async () => {
  const { createAuthSessionIdentityDbMock } = await import("./helpers/auth-session-identity-harness");
  return createAuthSessionIdentityDbMock();
});
vi.mock("@nexus/db", async () => ({
  sessionRepository: (await import("../packages/db/src/repositories/sessions")).sessionRepository,
}));

import {
  authSessionIdentityJoinedRow as joinedRow,
  authSessionIdentityNow as NOW,
  authSessionIdentityState as state,
  authSessionIdentityStoredToken as storedToken,
  authSessionIdentityToken as token,
  installAuthSessionIdentityHooks,
} from "./helpers/auth-session-identity-harness";

installAuthSessionIdentityHooks();

it("keeps the full session while excluding the user's password hash in SQL", async () => {
  const { sessionRepository } = await import("../packages/db/src/repositories/sessions");
  state.rows = [joinedRow(new Date(NOW.getTime() + 1000), "usr_1", "ses_1", true)];
  expect(await sessionRepository.findValidSession(token)).toMatchObject({
    session: {
      id: "ses_1",
      token: storedToken,
      ipAddress: "203.0.113.10",
      userAgent: "Private Browser",
    },
    user: { id: "usr_1", role: "user" },
  });
  expect(state.queries[0].sql).not.toContain('"password_hash"');
  expect(state.queries[0].sql).toContain('"sessions"."user_agent"');
  expect(state.queries[0].params).toEqual([storedToken, 1]);
});

it.each([-1, 0])("still denies expired legacy sessions (%s ms)", async (offset) => {
  const { sessionRepository } = await import("../packages/db/src/repositories/sessions");
  state.rows = [joinedRow(new Date(NOW.getTime() + offset), "usr_1", "ses_1", true)];
  expect(await sessionRepository.findValidSession(token)).toBeNull();
});

it.each(["not-a-date", "infinity", "-infinity"])(
  "fails closed for malformed or non-finite legacy expiry %s",
  async (value) => {
    const { sessionRepository } = await import("../packages/db/src/repositories/sessions");
    const row = joinedRow(new Date(NOW.getTime() + 1000), "usr_1", "ses_1", true);
    row[Object.keys(getTableColumns(sessions)).indexOf("expiresAt")] = value;
    state.rows = [row];
    expect(await sessionRepository.findValidSession(token)).toBeNull();
  },
);
