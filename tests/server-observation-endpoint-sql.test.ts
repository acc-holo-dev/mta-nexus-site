import { describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const mock = vi.hoisted(() => ({
  where: null as SQL | null,
}));
vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: () => ({
          values: () => ({
            onConflictDoNothing: () => ({
              returning: async () => [{ id: "obs_test" }],
            }),
          }),
        }),
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
    await repository.record(input, { ipAddress: "play.example.com", port: 22003 });
    if (!mock.where) throw new Error("UPDATE predicate missing");
    const statement = dialect.sqlToQuery(mock.where);
    expect(statement.sql).toContain('"servers"."ip_address"');
    expect(statement.sql).toContain('"servers"."port"');
    expect(statement.sql).toContain('"servers"."last_observed_at"');
    expect(statement.params).toContain("play.example.com");
    expect(statement.params).toContain(22003);
  });

  it("keeps compatibility for existing callers that do not provide an endpoint", async () => {
    mock.where = null;
    await repository.record(input);
    if (!mock.where) throw new Error("UPDATE predicate missing");
    const statement = dialect.sqlToQuery(mock.where);
    expect(statement.sql).not.toContain('"servers"."ip_address"');
    expect(statement.sql).not.toContain('"servers"."port"');
    expect(statement.params).toContain("srv_test");
  });
});
