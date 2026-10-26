import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { StorageObjectIdentity } from "@nexus/domain";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction") return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { StorageMaintenanceRepository } from "../packages/db/src/repositories/storage-maintenance";

const repo = new StorageMaintenanceRepository();
const now = new Date("2026-10-26T12:00:00Z");
const token = "raw-storage-token";
const digest = createHash("sha256").update(token).digest("hex");
const identity: StorageObjectIdentity = {
  key: "assets/usr_admin/object.zip",
  sizeBytes: 16,
  sha256Hash: "a".repeat(64),
  modifiedAt: "2026-10-01T00:00:00.000Z",
  device: "1",
  inode: "2",
  mtimeNs: "1",
  ctimeNs: "2",
};
const liveSession = (expiresAt = new Date(now.getTime() + 60_000)) => ["ses_admin", expiresAt.toISOString()];

beforeEach(() => {
  state.queries = [];
  state.results = [];
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

function writes() {
  return state.queries.filter((query) => /^(insert|update|delete) /u.test(query.sql));
}

it("refuses storage discovery when the initiating session is gone", async () => {
  state.results = [[["admin"]]];
  await expect(repo.observe("usr_admin", token, [identity])).rejects.toThrow("Authentication required");
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain('"sessions"');
  expect(state.queries[1].sql).toContain("for update");
  const selection = state.queries[1].sql.split(" from ")[0];
  expect(selection).toContain('"expires_at"');
  expect(selection).not.toContain('"token"');
  expect(selection).not.toContain('"ip_address"');
  expect(selection).not.toContain('"user_agent"');
  expect(state.queries[1].params).toContain(digest);
  expect(state.queries[1].params).not.toContain(token);
  expect(writes()).toEqual([]);
});

it("refuses storage retirement when the locked session is already expired", async () => {
  state.results = [[], [], [["admin"]], [liveSession(new Date(now.getTime()))]];
  await expect(repo.retire("usr_admin", token, "smo_a", 1)).rejects.toThrow("Authentication required");
  expect(writes()).toEqual([]);
});

it("locks a live session before recording a storage observation", async () => {
  state.results = [[["admin"]], [liveSession()], []];
  await expect(repo.observe("usr_admin", token, [])).resolves.toEqual({ observed: 0 });
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain('"sessions"');
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[1].params).toContain(digest);
  expect(state.queries.at(-1)?.sql).toMatch(/^insert into "audit_events" /);
  expect(state.queries.some((query) => query.sql.startsWith("insert into \"storage_maintenance_objects\""))).toBe(false);
});
