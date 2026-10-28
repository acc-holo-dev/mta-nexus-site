import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { users } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  failure: null as Error | null,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failure) throw state.failure;
    return { rows: state.results.shift() ?? [] };
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
});
import { UserRepository } from "../packages/db/src/repositories/users";
import { AuthRepository } from "../packages/db/src/repositories/auth";
import { toUserWithoutPassword } from "../packages/db/src/repositories/public-user-projection";

const repository = new UserRepository();
const auth = new AuthRepository();
const now = new Date("2026-10-09T10:15:00Z");
const fixture = {
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
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};
const row = (overrides: Partial<typeof fixture> = {}, credential = false) => {
  const values = { ...fixture, ...overrides };
  return Object.keys(getTableColumns(users))
    .filter((key) => credential || key !== "passwordHash")
    .map((key) => values[key as keyof typeof values] ?? null);
};
const expected = {
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
  createdAt: now,
  updatedAt: now,
};
const session = {
  id: "session",
  userId: "user-1",
  token: "raw-token",
  expiresAt: new Date(now.getTime() + 1000),
};
const tokenDigest = createHash("sha256").update("raw-token").digest("hex");
const liveSession = (expiresAt = new Date(now.getTime() + 60_000)) => [
  "ses_1",
  expiresAt.toISOString(),
];
const contextSwitch = (contextId: string) =>
  auth.switchContext({
    userId: "user-1",
    contextId,
    auditId: "audit",
    currentToken: "raw-token",
  });
const audit = {
  id: "audit",
  actorId: "user-1",
  actorType: "user" as const,
  action: "user.registered",
  targetId: "user-1",
  targetType: "user",
};
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.failure = null;
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

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
it("keeps the locked no-op personal context credential-free", async () => {
  state.results = [[row()], [liveSession()]];
  expect(await contextSwitch("personal")).toMatchObject(expected);
  expect(state.queries).toHaveLength(2);
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
    [row({ activeContextId: "organization" })],
    [],
  ];
  const result = await contextSwitch("organization");
  expect(result).toMatchObject({ id: "user-1", activeContextId: "organization" });
  expect(result).not.toHaveProperty("passwordHash");
  expect(state.queries).toHaveLength(5);
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain('"sessions"');
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toMatch(/^update "users" /);
  expect(state.queries[4].sql).toMatch(/^insert into "audit_events" /);
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
  state.results = [[row()], [liveSession()]];
  await expect(contextSwitch("personal")).resolves.toMatchObject(expected);
  expect(state.queries).toHaveLength(2);
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
