import { describe, expect, it, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const state = vi.hoisted(() => ({ values: null as Record<string, unknown> | null }));
vi.mock("../packages/db/src/client", () => ({
  db: {
    update: () => ({
      set(values: Record<string, unknown>) {
        state.values = values;
        return { where: () => ({ returning: async () => [{ id: "srv_test" }] }) };
      },
    }),
  },
}));
import { ServerRepository } from "../packages/db/src/repositories/servers";

const repo = new ServerRepository();
const dialect = new PgDialect();
beforeEach(() => {
  state.values = null;
});

describe("atomic endpoint revision and verification SQL", () => {
  it("keeps editorial-only server updates free of endpoint side effects", async () => {
    await repo.update("srv_test", { description: "Reworded introduction" });
    expect(state.values).not.toHaveProperty("endpointRevision");
    expect(state.values).not.toHaveProperty("isVerified");
    expect(state.values).not.toHaveProperty("currentPlayers");
  });

  it("conditionally increments revision and clears verification on IP/port changes", async () => {
    await repo.update("srv_test", { ipAddress: "play.example.com", port: 22003 });
    const values = state.values;
    expect(values).toBeTruthy();
    for (const field of ["endpointRevision", "isVerified", "lastObservedAt"]) {
      const sql = dialect.sqlToQuery(values?.[field] as SQL);
      expect(sql.sql).toContain("CASE WHEN");
      expect(sql.sql).toContain("IS DISTINCT FROM");
      expect(sql.params).toContain("play.example.com");
      expect(sql.params).toContain(22003);
    }
    expect(dialect.sqlToQuery(values?.endpointRevision as SQL).sql).toContain(
      '"servers"."endpoint_revision" + 1',
    );
    expect(dialect.sqlToQuery(values?.isVerified as SQL).sql).toContain("THEN false");
  });

  it("preserves an explicitly edited owner capacity", async () => {
    await repo.update("srv_test", { port: 22004, maxPlayers: 96 });
    expect(state.values?.maxPlayers).toBe(96);
    expect(state.values).toHaveProperty("endpointRevision");
  });
});
