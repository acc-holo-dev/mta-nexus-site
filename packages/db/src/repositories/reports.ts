import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, reports, moderationCases } from "../schema";
import type { AuditEvent, Report, ModerationCase } from "@nexus/domain";

export class ReportRepository {
  async listAll(): Promise<Report[]> {
        const rows = await db.select().from(reports).orderBy(desc(reports.createdAt));
    return rows as unknown as Report[];
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

  async resolve(
    id: string,
    status: "resolved" | "dismissed",
    moderatorNotes: string,
    audit?: Omit<AuditEvent, "createdAt">,
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

      if (audit) {
        await tx.insert(auditEvents).values({
          ...audit,
          createdAt: now,
        });
      }

      return resolved as unknown as Report;
    });
  }
}

export const reportRepository = new ReportRepository();
