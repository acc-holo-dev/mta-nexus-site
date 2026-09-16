import { desc } from "drizzle-orm";
import { db } from "../client";
import { auditEvents } from "../schema";
import type { AuditEvent } from "@nexus/domain";

export class AuditRepository {
  async record(event: Omit<AuditEvent, "createdAt">): Promise<AuditEvent> {
    const values = {
      ...event,
      createdAt: new Date(),
    };

        await db.insert(auditEvents).values(values);
    return values;
  }

  async listRecent(limit = 50): Promise<AuditEvent[]> {
        const rows = await db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
    return rows as unknown as AuditEvent[];
  }
}

export const auditRepository = new AuditRepository();
