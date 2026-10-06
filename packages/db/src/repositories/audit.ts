import { and, desc, eq, inArray } from "drizzle-orm";
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

  async listByActor(
    actorId: string,
    actions: string[],
    limit = 50,
  ): Promise<AuditEvent[]> {
    if (actions.length === 0) return [];
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 50;
    const rows = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.actorId, actorId),
          inArray(auditEvents.action, actions),
        ),
      )
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(boundedLimit);
    return rows as unknown as AuditEvent[];
  }
}

export const auditRepository = new AuditRepository();
