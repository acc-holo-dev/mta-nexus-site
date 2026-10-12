import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: null as unknown,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options: unknown) => {
            state.options = options;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { AuditRepository } from "../packages/db/src/repositories/audit";

const repo = new AuditRepository(),
  until = "2026-10-12T00:00:00.123456Z",
  filters = { action: "all" as const, period: "all" as const };
const event = (id = "audit") => [
  id,
  "server.updated",
  "editor",
  "user",
  "editor",
  "Editor",
  ["visibility"],
  "2026-10-11T00:00:00.000Z",
  "public",
  "private",
];
const context = (actor = "actor", period = "all", action = "all") =>
  createHash("sha256")
    .update(JSON.stringify([1, "server-management-history", actor, "server", period, action]))
    .digest("hex");
beforeEach(() => {
  state.queries = [];
  state.options = null;
  state.rows = [[["server", "Server", "server"]], [[until]], [event()]];
});
it("reads current authority, database clock and at most 21 safe audit projections in one snapshot", async () => {
  const result = await repo.managedServerHistory("server", "actor", filters);
  expect(result.events).toHaveLength(1);
  expect(result.until).toBe(until);
  expect(state.options).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(3);
  expect(state.queries[0].sql).toContain('"users"."role" =');
  expect(state.queries[1].sql).toContain("current_timestamp");
  const read = state.queries[2];
  expect(read.params).toContain(until);
  expect(read.params.at(-1)).toBe(21);
  expect(read.sql).not.toMatch(/offset|count\(/u);
  const selected = read.sql.split(' from "audit_events"')[0];
  for (const secret of ["email", "password_hash", "user_agent", "ip_address", "token_digest"])
    expect(selected).not.toContain(`"${secret}"`);
  expect(selected).not.toContain('"audit_events"."details",');
  expect(read.sql).toContain("jsonb_array_elements_text");
});
it.each(["listing", "visibility", "control", "verification"] as const)(
  "filters the existing action allowlist and period in SQL (%s)",
  async (action) => {
    await repo.managedServerHistory("server", "actor", { period: "30", action });
    const read = state.queries[2];
    expect(read.params).toContain(30);
    expect(read.sql).toContain("interval '1 day'");
    if (action === "visibility") expect(read.sql).toContain("? 'visibility'");
    if (action === "control")
      expect(read.params).toEqual(
        expect.arrayContaining(["server.claim_challenge_issued", "server.control_proof_recorded"]),
      );
    if (action === "verification") expect(read.params).toContain("server.verification_approved");
  },
);
it("anchors microseconds in SQL and keeps the reviewed cutoff window on later pages", async () => {
  state.rows[2] = Array.from({ length: 21 }, (_, i) => event(`event_${i}`));
  const first = await repo.managedServerHistory("server", "actor", filters);
  expect(first.events).toHaveLength(20);
  expect(first.nextCursor).toEqual({ context: context(), until, id: "event_19" });
  state.queries = [];
  state.rows = [[["server", "Server", "server"]], [["2026-10-13T00:00:00.000000Z"]], []];
  await repo.managedServerHistory("server", "actor", {
    ...filters,
    cursor: first.nextCursor ?? undefined,
  });
  const read = state.queries[2];
  expect(read.params).toContain(until);
  expect(read.params).not.toContain("2026-10-13T00:00:00.000000Z");
  expect(read.sql).toContain('("audit_events"."created_at","audit_events"."id") <');
  expect(read.sql).toContain('"server_history_anchor"."target_id"');
  expect(read.params).toContain("event_19");
});
it.each(["actor", "server", "action", "period"])(
  "rejects a cursor from another context (%s) after checking live access but before reading events",
  async (kind) => {
    await expect(
      repo.managedServerHistory(
        kind === "server" ? "other" : "server",
        kind === "actor" ? "other" : "actor",
        {
          ...filters,
          ...(kind === "action" ? { action: "visibility" as const } : {}),
          ...(kind === "period" ? { period: "7" as const } : {}),
          cursor: { context: context(), until, id: "audit" },
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(1);
  },
);
it("uses current grants before both history and cursor validation", async () => {
  state.rows = [[]];
  await expect(
    repo.managedServerHistory("server", "revoked", {
      ...filters,
      cursor: { context: "f".repeat(64), until, id: "audit" },
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
it("exports the same cutoff and rejects future or contradictory cutoff windows", async () => {
  await repo.managedServerHistory("server", "actor", {
    ...filters,
    until: "2026-10-11T00:00:00.000000Z",
  });
  expect(state.queries[2].params).toContain("2026-10-11T00:00:00.000000Z");
  state.queries = [];
  state.rows = [[["server", "Server", "server"]], [[until]]];
  await expect(
    repo.managedServerHistory("server", "actor", {
      ...filters,
      until: "2099-01-01T00:00:00.000000Z",
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(2);
  state.rows = [[["server", "Server", "server"]], [[until]]];
  await expect(
    repo.managedServerHistory("server", "actor", {
      ...filters,
      until: "2026-10-11T00:00:00.000000Z",
      cursor: { context: context(), until, id: "audit" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("preserves valid legacy server-scoped anchors and excludes mixed legacy filters", async () => {
  await repo.managedServerHistory("server", "actor", { ...filters, legacyCursor: "old_audit" });
  expect(state.queries[2].params).toContain("old_audit");
  state.queries = [];
  state.rows = [[["server", "Server", "server"]]];
  await expect(
    repo.managedServerHistory("server", "actor", {
      period: "7",
      action: "all",
      legacyCursor: "old_audit",
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
it("does not convert database unavailability into an empty successful history", async () => {
  state.rows = [[["server", "Server", "server"]], []];
  await expect(repo.managedServerHistory("server", "actor", filters)).rejects.toThrow(
    "clock unavailable",
  );
  expect(state.queries).toHaveLength(2);
});
