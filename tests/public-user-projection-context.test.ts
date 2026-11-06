import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createPublicUserProjectionDbMock } = await import(
    "./helpers/public-user-projection-harness"
  );
  return createPublicUserProjectionDbMock();
});

import { AuthRepository } from "../packages/db/src/repositories/auth";
import {
  installPublicUserProjectionHooks,
  publicUserProjectionExpected as expected,
  publicUserProjectionLiveSession as liveSession,
  publicUserProjectionNow as now,
  publicUserProjectionRow as row,
  publicUserProjectionState as state,
  publicUserProjectionTokenDigest as tokenDigest,
} from "./helpers/public-user-projection-harness";

const auth = new AuthRepository();
const contextSwitch = (contextId: string) =>
  auth.switchContext({
    userId: "user-1",
    contextId,
    auditId: "audit",
    currentToken: "raw-token",
  });

installPublicUserProjectionHooks();

it("keeps the locked no-op personal context credential-free", async () => {
  state.results = [[row()], [liveSession()], [liveSession()]];
  expect(await contextSwitch("personal")).toMatchObject(expected);
  expect(state.queries).toHaveLength(3);
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].sql).not.toContain('"password_hash"');
  expect(state.queries[1].sql).not.toContain('"password_hash"');
  expect(state.queries[1].params).not.toContain("raw-token");
});

it("checks a current owner under locks, writes context and audit, and returns no credential", async () => {
  state.results = [
    [row()],
    [liveSession()],
    [["user-1"]],
    [liveSession()],
    [row({ activeContextId: "organization" })],
    [],
    [liveSession()],
  ];
  const result = await contextSwitch("organization");
  expect(result).toMatchObject({ id: "user-1", activeContextId: "organization" });
  expect(result).not.toHaveProperty("passwordHash");
  expect(state.queries).toHaveLength(7);
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain('"sessions"');
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[4].sql).toMatch(/^update "users" /);
  expect(state.queries[5].sql).toMatch(/^insert into "audit_events" /);
  for (const query of state.queries) expect(query.sql).not.toContain('"password_hash"');
});

it("requires current membership before a non-owned context mutation", async () => {
  state.results = [[row()], [liveSession()], [["other-owner"]], []];
  await expect(contextSwitch("organization")).rejects.toThrow("Not authorized");
  expect(state.queries).toHaveLength(4);
  expect(state.queries[1].sql).toContain('"sessions"');
  expect(state.queries[3].sql).toContain("for share");
  expect(state.queries.every((query) => !query.sql.startsWith("update "))).toBe(true);
});

it("rechecks session expiry after organization access and before changing context", async () => {
  state.results = [[row()], [liveSession()], [["user-1"]], [liveSession(new Date(now.getTime()))]];
  await expect(contextSwitch("organization")).rejects.toThrow("Authentication required");
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("update ") && !query.sql.startsWith("insert "),
    ),
  ).toBe(true);
});

it("rechecks the initiating session before a context write and fails closed when it is gone", async () => {
  state.results = [[row()]];
  await expect(contextSwitch("organization")).rejects.toThrow("Authentication required");
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain('"sessions"');
  expect(state.queries[1].sql).toContain("for update");
  const selection = state.queries[1].sql.split(" from ")[0];
  expect(selection).toContain('"id"');
  expect(selection).toContain('"expires_at"');
  expect(selection).not.toContain('"token"');
  expect(selection).not.toContain('"ip_address"');
  expect(selection).not.toContain('"user_agent"');
  expect(state.queries[1].params).toContain(tokenDigest);
  expect(state.queries[1].params).not.toContain("raw-token");
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("update ") && !query.sql.startsWith("insert "),
    ),
  ).toBe(true);
});

it("locks a live session and still skips a no-op personal context write", async () => {
  state.results = [[row()], [liveSession()], [liveSession()]];
  await expect(contextSwitch("personal")).resolves.toMatchObject(expected);
  expect(state.queries).toHaveLength(3);
  expect(state.queries[1].sql).toContain('"sessions"');
  expect(state.queries[1].params).toContain(tokenDigest);
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("update ") && !query.sql.startsWith("insert "),
    ),
  ).toBe(true);
});

it("does not switch context when the locked session is already expired", async () => {
  state.results = [[row()], [liveSession(new Date(now.getTime()))]];
  await expect(contextSwitch("organization")).rejects.toThrow("Authentication required");
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("update ") && !query.sql.startsWith("insert "),
    ),
  ).toBe(true);
});
