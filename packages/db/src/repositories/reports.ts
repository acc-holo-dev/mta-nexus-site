import { and, asc, count, eq, desc, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, reports } from "../schema";
import type { AuditEvent, Report } from "@nexus/domain";

export class ReportRepository {
  async countOpen(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(reports).where(
      inArray(reports.status, ["open", "under_review"]),
    );
    return row?.total ?? 0;
  }

  async listPage(view: "pending" | "history", page: number, pageSize = 30): Promise<{ reports: Report[]; hasMore: boolean }> {
    if (!Number.isSafeInteger(page) || page < 1 || page > 99_999 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Invalid report page");
    }
    const filter = view === "pending" ? ["open", "under_review"] : ["resolved", "dismissed"];
    const ordering = view === "pending"
      ? [asc(reports.createdAt), asc(reports.id)]
      : [desc(reports.resolvedAt), desc(reports.id)];
    const rows = await db.select().from(reports)
      .where(inArray(reports.status, filter))
      .orderBy(...ordering)
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    return { reports: rows.slice(0, pageSize) as unknown as Report[], hasMore: rows.length > pageSize };
  }

  async findById(id: string): Promise<Report | null> {
        const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return (rows[0] as unknown as Report) || null;
  }

  async findOpenByReporterAndTarget(
    reporterId: string,
    targetType: Report["targetType"],
    targetId: string
  ): Promise<Report | null> {
    const rows = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, reporterId),
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          eq(reports.status, "open")
        )
      )
      .limit(1);
    return (rows[0] as unknown as Report) || null;
  }

  async create(data: Omit<Report, "createdAt" | "resolvedAt">): Promise<Report> {
    const values = {
      ...data,
      createdAt: new Date(),
      resolvedAt: null,
    };

        const rows = await db.insert(reports).values(values).returning();
    return rows[0] as unknown as Report;
  }

  async createWithAudit(
    data: Omit<Report, "createdAt" | "resolvedAt">,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<{ report: Report; created: boolean }> {
    return db.transaction(async (tx) => {
      const lockKey = `report:${data.reporterId}:${data.targetType}:${data.targetId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const [existing] = await tx.select().from(reports).where(and(
        eq(reports.reporterId, data.reporterId),
        eq(reports.targetType, data.targetType),
        eq(reports.targetId, data.targetId),
        eq(reports.status, "open"),
      )).limit(1);
      if (existing) return { report: existing as unknown as Report, created: false };

      const now = new Date();
      const [report] = await tx.insert(reports).values({
        ...data, createdAt: now, resolvedAt: null,
      }).returning();
      if (!report) throw new Error("Report insert did not return a row");
      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return { report: report as unknown as Report, created: true };
    });
  }

  async resolve(
    id: string,
    status: "resolved" | "dismissed",
    moderatorNotes: string,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Report | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .update(reports)
        .set({ status, moderatorNotes, resolvedAt: now })
        .where(
          and(
            eq(reports.id, id),
            inArray(reports.status, ["open", "under_review"]),
          ),
        )
        .returning();
      const resolved = rows[0];
      if (!resolved) return null;

      await tx.insert(auditEvents).values({
        ...audit,
        createdAt: now,
      });

      return resolved as unknown as Report;
    });
  }
}

export const reportRepository = new ReportRepository();
