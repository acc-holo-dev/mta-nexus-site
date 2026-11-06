import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createPublicUserProjectionDbMock } = await import(
    "./helpers/public-user-projection-harness"
  );
  return createPublicUserProjectionDbMock();
});

import { AuthRepository } from "../packages/db/src/repositories/auth";
import { toUserWithoutPassword } from "../packages/db/src/repositories/public-user-projection";
import { UserRepository } from "../packages/db/src/repositories/users";
import {
  installPublicUserProjectionHooks,
  publicUserProjectionAudit as audit,
  publicUserProjectionExpected as expected,
  publicUserProjectionFixture as fixture,
  publicUserProjectionNow as now,
  publicUserProjectionRow as row,
  publicUserProjectionSession as session,
  publicUserProjectionState as state,
} from "./helpers/public-user-projection-harness";

const repository = new UserRepository();
const auth = new AuthRepository();

installPublicUserProjectionHooks();

const reads = [
  ["ID lookup", () => repository.findById("user-1")],
  ["username lookup", () => repository.findByUsername("account")],
  ["developer search", () => repository.searchDevelopers("Developer")],
  ["user list", () => repository.listAll()],
  ["bounded user list", () => repository.listAll(10)],
  ["developer list", () => repository.listDevelopers()],
] as const;

it.each(reads)(
  "excludes credentials from SQL and maps account fields in %s",
  async (_name, read) => {
    state.results = [[row()]];
    const result = await read();
    const user = Array.isArray(result) ? result[0] : result;
    expect(user).toMatchObject(expected);
    expect(user).not.toHaveProperty("passwordHash");
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].sql).not.toContain('"password_hash"');
  },
);

it.each(reads)("preserves an absent result in %s", async (_name, read) => {
  const result = await read();
  expect(result).toEqual(Array.isArray(result) ? [] : null);
  expect(state.queries).toHaveLength(1);
});

it("preserves the credential read for case-normalized login/recovery lookup", async () => {
  state.results = [[row({}, true)]];
  expect(await repository.findByEmail("USER@EXAMPLE.TEST")).toMatchObject({
    ...expected,
    passwordHash: "stored-credential",
  });
  expect(state.queries[0].sql).toContain('"password_hash"');
  expect(state.queries[0].params).toEqual(["user@example.test", 1]);
});

it("creates a user with a credential write and a credential-free returning projection", async () => {
  state.results = [[row()]];
  const result = await repository.create({
    id: "user-1",
    email: "USER@EXAMPLE.TEST",
    username: "account",
    displayName: "Account",
    passwordHash: "stored-credential",
  });
  expect(result).toMatchObject(expected);
  expect(result).not.toHaveProperty("passwordHash");
  expect(state.queries[0].params).toContain("stored-credential");
  expect(state.queries[0].params).toContain("user@example.test");
  expect(state.queries[0].sql.split(" returning ")[1]).not.toContain('"password_hash"');
});

it("updates public fields without returning a credential", async () => {
  state.results = [[row({ displayName: "Updated" })]];
  expect(await repository.update("user-1", { displayName: "Updated" })).toMatchObject({
    displayName: "Updated",
    id: "user-1",
  });
  expect(state.queries[0].params).toContain("Updated");
  expect(state.queries[0].params).toContain("user-1");
  expect(state.queries[0].sql.split(" returning ")[1]).not.toContain('"password_hash"');
});

it("preserves a missing updated user and error propagation", async () => {
  expect(await repository.update("missing", { displayName: "Updated" })).toBeNull();
  state.failure = new Error("Database unavailable");
  await expect(repository.findById("user-1")).rejects.toThrow();
});

it("still strips a credential supplied by an adapter outside the SQL projection", () => {
  expect(toUserWithoutPassword({ ...fixture, createdAt: now, updatedAt: now })).toMatchObject(
    expected,
  );
  expect(toUserWithoutPassword({ ...fixture, createdAt: now, updatedAt: now })).not.toHaveProperty(
    "passwordHash",
  );
});

it("registers a user, session and audit while returning no password hash", async () => {
  state.results = [[row()], [], []];
  const result = await auth.registerAccount({
    user: {
      id: "user-1",
      email: "USER@EXAMPLE.TEST",
      username: "account",
      displayName: "Account",
      passwordHash: "stored-credential",
    },
    session,
    audit,
  });
  expect(result).toMatchObject(expected);
  expect(result).not.toHaveProperty("passwordHash");
  expect(state.queries).toHaveLength(3);
  expect(state.queries[0].sql.split(" returning ")[1]).not.toContain('"password_hash"');
  expect(state.queries[0].params).toContain("stored-credential");
  expect(state.queries[1].sql).toMatch(/^insert into "sessions" /);
  expect(state.queries[1].params).not.toContain("raw-token");
  expect(state.queries[2].sql).toMatch(/^insert into "audit_events" /);
});

it.each(["stored-credential", "changed-credential"])(
  "retains the locked password revalidation for a login against %s",
  async (password) => {
    state.results = [[[password]], [], []];
    const operation = auth.createLoginSession(session, audit, "stored-credential");
    if (password === "stored-credential") {
      await operation;
      expect(state.queries).toHaveLength(3);
    } else {
      await expect(operation).rejects.toThrow("Invalid email or password");
      expect(state.queries).toHaveLength(1);
    }
    expect(state.queries[0].sql).toMatch(/^select "password_hash" from "users" /);
    expect(state.queries[0].sql).toContain("for update");
  },
);
