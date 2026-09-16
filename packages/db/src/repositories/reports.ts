import { eq, desc } from "drizzle-orm";
import { db } from "../client";
import { reports, moderationCases } from "../schema";
import type { Report, ModerationCase } from "@nexus/domain";

export class ReportRepository {
  async listAll(): Promise<Report[]> {
    try {
      const rows = await db.select().from(reports).orderBy(desc(reports.createdAt));
      return rows as unknown as Report[];
    } catch {
      return [];
    }
  }

  async findById(id: string): Promise<Report | null> {
    try {
      const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
      return (rows[0] as unknown as Report) || null;
    } catch {
      return null;
    }
  }

  async create(data: Omit<Report, "createdAt" | "resolvedAt">): Promise<Report> {
    const values = {
      ...data,
      createdAt: new Date(),
      resolvedAt: null,
    };

    try {
      const rows = await db.insert(reports).values(values).returning();
      return rows[0] as unknown as Report;
    } catch {
      return values as unknown as Report;
    }
  }

  async resolve(id: string, status: "resolved" | "dismissed", moderatorNotes: string): Promise<Report | null> {
    try {
      const rows = await db
        .update(reports)
        .set({ status, moderatorNotes, resolvedAt: new Date() })
        .where(eq(reports.id, id))
        .returning();
      return (rows[0] as unknown as Report) || null;
    } catch {
      return null;
    }
  }
}

export const reportRepository = new ReportRepository();
