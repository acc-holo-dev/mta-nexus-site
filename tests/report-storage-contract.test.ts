import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { AuditEvent, Report } from "@nexus/domain";
import { auditEvents, reports, reportNotificationDeliveries } from "../packages/db/src/schema";

const captured = vi.hoisted(() => ({
  inserts: [] as unknown[],
  selected: null as Record<string, unknown> | null,
  filter: null as SQL | null,
  lock: null as SQL | null,
  existing: null as { id: string } | null,
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        execute: async (statement: SQL) => {
          captured.lock = statement;
        },
        select: () => ({
          from: () => ({
            where: (filter: SQL) => ({
              limit: async () => {
                captured.filter = filter;
                return captured.existing ? [captured.existing] : [];
              },
            }),
          }),
        }),
        insert(table: unknown) {
          captured.inserts.push(table);
          return {
            values: () =>
              table === reports
                ? {
                    returning: async () => {
                      captured.existing = { id: "rpt_1" };
                      return [captured.existing];
                    },
                  }
                : Promise.resolve(),
          };
        },
      }),
    select(selection: Record<string, unknown>) {
      captured.selected = selection;
      return {
        from: () => ({
          where: (filter: SQL) => {
            captured.filter = filter;
            return Promise.resolve([{ id: "mod_1" }]);
          },
        }),
      };
    },
  },
}));

import { ReportRepository } from "../packages/db/src/repositories/reports";
import { UserRepository } from "../packages/db/src/repositories/users";

describe("report write and notification lookup", () => {
  it("stores the report and its audit entry using the same transaction", async () => {
    captured.existing = null;
    captured.inserts = [];
    const data: Omit<Report, "createdAt" | "resolvedAt"> = {
      id: "rpt_1",
      reporterId: "member_1",
      targetType: "product",
      targetId: "prd_1",
      type: "scam",
      reason: "An unsafe product",
      evidenceUrls: [],
      status: "open",
    };
    const audit: Omit<AuditEvent, "createdAt"> = {
      id: "aud_1",
      actorId: "member_1",
      actorType: "user",
      action: "report.created",
      targetId: "rpt_1",
      targetType: "report",
      details: {},
    };
    const result = await new ReportRepository().createWithAudit(data, audit);
    expect(result).toMatchObject({ report: { id: "rpt_1" }, created: true });
    expect(captured.inserts).toEqual([reports, auditEvents, reportNotificationDeliveries]);
    if (!captured.lock) throw new Error("Expected report advisory lock to be captured");
    expect(new PgDialect().sqlToQuery(captured.lock).sql).toContain("pg_advisory_xact_lock");

    const duplicate = await new ReportRepository().createWithAudit(data, audit);
    expect(duplicate).toMatchObject({ report: { id: "rpt_1" }, created: false });
    expect(captured.inserts).toEqual([reports, auditEvents, reportNotificationDeliveries]);
  });

  it("fetches only moderator IDs and does not hydrate account data", async () => {
    expect(await new UserRepository().listModeratorIds()).toEqual(["mod_1"]);
    expect(Object.keys(captured.selected ?? {})).toEqual(["id"]);
    if (!captured.filter) throw new Error("Expected moderator filter to be captured");
    const filterParams = new PgDialect().sqlToQuery(captured.filter).params;
    expect(filterParams).toContain("moderator");
    expect(filterParams).toContain("admin");
  });
});
