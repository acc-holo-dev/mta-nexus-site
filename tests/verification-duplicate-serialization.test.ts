import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({
  filter: null as SQL | null,
  pending: true,
  inserts: [] as unknown[],
  lock: null as SQL | null,
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      execute: async (statement: SQL) => { captured.lock = statement; },
      select: () => ({ from: () => ({ where: (condition: SQL) => {
        captured.filter = condition;
        return { limit: async () => captured.pending ? [{ id: "ver_existing" }] : [] };
      } }) }),
      insert: (table: unknown) => {
        captured.inserts.push(table);
        return { values: () => ({ returning: async () => [{ id: "ver_new", createdAt: new Date() }] }) };
      },
    }),
  },
}));

import { VerificationRepository } from "../packages/db/src/repositories/verification";
import { auditEvents, verificationRequests } from "../packages/db/src/schema";

describe("verification application serialization", () => {
  it("refuses a second application for the same target before writing an audit or request", async () => {
    captured.pending = true;
    captured.inserts = [];
    await expect(new VerificationRepository().createRequest({
      requesterId: "manager_2", targetType: "organization", targetId: "org_1",
    })).rejects.toMatchObject({ statusCode: 409 });
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(captured.lock!).sql).toContain("pg_advisory_xact_lock");
    expect(dialect.sqlToQuery(captured.lock!).params).toEqual(["verification:organization:org_1"]);
    expect(dialect.sqlToQuery(captured.filter!).params).toEqual(["organization", "org_1", "pending"]);
    expect(captured.inserts).toEqual([]);
  });

  it("stores the application and audit together when there is no pending request", async () => {
    captured.pending = false;
    captured.inserts = [];
    const request = await new VerificationRepository().createRequest({
      requesterId: "manager_1", targetType: "organization", targetId: "org_1",
    }, {
      id: "aud_new", actorId: "manager_1", actorType: "user", action: "verification.requested",
    });
    expect(request.id).toBe("ver_new");
    expect(captured.inserts).toEqual([verificationRequests, auditEvents]);
  });
});
