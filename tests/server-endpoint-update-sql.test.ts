import { describe, expect, it, beforeEach, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const capture = vi.hoisted(() => ({
  values: null as Record<string, unknown> | null,
  order: [] as SQL[],
  limit: 0,
}));
vi.mock("../packages/db/src/client", () => ({
  db: {
    update: () => ({
      set(values: Record<string, unknown>) {
        capture.values = values;
        return {
          where: () => ({
            returning: async () => [{ id: "srv_test" }],
          }),
        };
      },
    }),
    select: () => {
      const query = {
        from: () => query,
        where: () => query,
        orderBy(...fields: SQL[]) {
          capture.order = fields;
          return query;
        },
        limit(limit: number) {
          capture.limit = limit;
          return Promise.resolve([]);
        },
      };
      return query;
    },
  },
}));
import { ServerRepository } from "../packages/db/src/repositories/servers";

const dialect = new PgDialect();
const repository = new ServerRepository();
beforeEach(() => {
  capture.values = null;
  capture.order = [];
  capture.limit = 0;
});

describe("server endpoint update SQL", () => {
  it("does not touch live fields for a profile-only update", async () => {
    await repository.update("srv_test", { description: "new description" });
    expect(capture.values).toHaveProperty("description", "new description");
    expect(capture.values).not.toHaveProperty("currentPlayers");
    expect(capture.values).not.toHaveProperty("lastObservedAt");
    expect(capture.values).not.toHaveProperty("observationSource");
  });

  it("uses atomic IS DISTINCT FROM checks on IP and port edits", async () => {
    await repository.update("srv_test", {
      ipAddress: "example.com",
      port: 22003,
    });
    const values = capture.values ?? {};
    for (const field of ["currentPlayers", "lastObservedAt", "observationSource", "maxPlayers"]) {
      expect(values).toHaveProperty(field);
      const statement = dialect.sqlToQuery(values[field] as SQL);
      expect(statement.sql).toContain("CASE WHEN");
      expect(statement.sql).toContain("IS DISTINCT FROM");
      expect(statement.params).toContain("example.com");
      expect(statement.params).toContain(22003);
    }
  });

  it("preserves an explicitly supplied owner capacity when endpoint changes", async () => {
    await repository.update("srv_test", {
      port: 22004,
      maxPlayers: 128,
    });
    expect(capture.values?.maxPlayers).toBe(128);
    expect(capture.values).toHaveProperty("currentPlayers");
  });

  it("uses a stable unique ID sort for bounded public listings", async () => {
    await repository.listActivePublic(25);
    expect(capture.limit).toBe(25);
    expect(capture.order.map((column) => dialect.sqlToQuery(column).sql)).toEqual([
      '"servers"."updated_at" desc',
      '"servers"."id" desc',
    ]);
  });
});
