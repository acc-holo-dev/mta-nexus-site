import { describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const mock = vi.hoisted(() => ({
  where: null as SQL | null,
  lockWhere: null as SQL | null,
  lockMode: null as string | null,
  lockedMatch: true,
  insertCalls: 0,
}));
vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => {
          const query = {
            from: () => query,
            where: (where: SQL) => {
              mock.lockWhere = where;
              return query;
            },
            for: (mode: string) => {
              mock.lockMode = mode;
              return query;
            },
            limit: async () => (mock.lockedMatch ? [{ id: "srv_test" }] : []),
          };
          return query;
        },
        insert: () => {
          mock.insertCalls++;
          return {
            values: () => ({
              onConflictDoNothing: () => ({
                returning: async () => [{ id: "obs_test" }],
              }),
            }),
          };
        },
        update: () => ({
          set: () => ({
            where: (condition: SQL) => {
              mock.where = condition;
              return Promise.resolve([]);
            },
          }),
        }),
      };
      return fn(tx);
    },
  },
}));
vi.mock("@nexus/security", () => ({ generateId: () => "obs_test" }));

import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";

const repository = new ServerObservationRepository();
const dialect = new PgDialect();
const input = {
  serverId: "srv_test",
  source: "mta_master" as const,
  sourceSequence: "2026-10-09T00:00:00.000Z",
  observedAt: new Date("2026-10-09T00:00:00.000Z"),
  currentPlayers: 9,
  responding: true,
};

describe("endpoint-bound observation UPDATE", () => {
  it("requires matching address and port when collector supplies an endpoint", async () => {
    mock.where = null;
    mock.lockWhere = null;
    mock.lockMode = null;
    mock.lockedMatch = true;
    await repository.record(input, { ipAddress: "play.example.com", port: 22003 });
    expect(mock.lockMode).toBe("update");
    if (!mock.lockWhere) throw new Error("Lock predicate missing");
    const lock = dialect.sqlToQuery(mock.lockWhere);
    expect(lock.params).toContain("play.example.com");
    expect(lock.params).toContain(22003);
    if (!mock.where) throw new Error("UPDATE predicate missing");
    const statement = dialect.sqlToQuery(mock.where);
    expect(statement.sql).toContain('"servers"."ip_address"');
    expect(statement.sql).toContain('"servers"."port"');
    expect(statement.sql).toContain('"servers"."last_observed_at"');
    expect(statement.params).toContain("play.example.com");
    expect(statement.params).toContain(22003);
  });

  it("checks endpoint revision to reject A -> B -> A reuse", async () => {
    mock.lockedMatch = true;
    mock.lockWhere = null;
    await repository.record(input, {
      ipAddress: "play.example.com",
      port: 22003,
      endpointRevision: 7,
    });
    if (!mock.lockWhere) throw new Error("Missing SQL lock predicate");
    const query = dialect.sqlToQuery(mock.lockWhere);
    expect(query.sql).toContain('"servers"."endpoint_revision"');
    expect(query.params).toContain(7);
  });

  it("keeps compatibility for existing callers that do not provide an endpoint", async () => {
    mock.where = null;
    mock.lockWhere = null;
    mock.lockMode = null;
    await repository.record(input);
    expect(mock.lockMode).toBeNull();
    if (!mock.where) throw new Error("UPDATE predicate missing");
    const statement = dialect.sqlToQuery(mock.where);
    expect(statement.sql).not.toContain('"servers"."ip_address"');
    expect(statement.sql).not.toContain('"servers"."port"');
    expect(statement.params).toContain("srv_test");
  });
  it("rejects stale endpoint captures without inserting history or updating live fields", async () => {
    mock.lockWhere = null;
    mock.lockedMatch = false;
    mock.where = null;
    mock.insertCalls = 0;
    try {
      await expect(
        repository.record(input, {
          ipAddress: "obsolete.example.com",
          port: 22003,
        }),
      ).resolves.toBeNull();
      expect(mock.lockMode).toBe("update");
      expect(mock.insertCalls).toBe(0);
      expect(mock.where).toBeNull();
    } finally {
      mock.lockedMatch = true;
    }
  });
});
