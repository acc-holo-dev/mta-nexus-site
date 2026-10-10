import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { auditEvents, servers, users } from "../schema";
import {
  SERVER_ACTIVITY_ACTIONS,
  SERVER_ACTIVITY_FIELDS,
  serverActivityCursor,
  type AuditEvent,
  type ServerActivityAction,
  type ServerActivityField,
  type User,
} from "@nexus/domain";
import { managedServerScope } from "./server-management-scope";

export type ServerActivityItem = {
  id: string;
  action: ServerActivityAction;
  actorId: string;
  actorType: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  fields: ServerActivityField[];
  createdAt: Date;
};

export type ManagedServerActivity = {
  server: { id: string; name: string };
  events: ServerActivityItem[];
  nextCursor: string | null;
};

export class AuditRepository {
  /** Private, bounded activity. Authority and rows come from one consistent snapshot. */
  async pageForManagedServer(
    serverId: string,
    actor: Pick<User, "id" | "role">,
    cursor?: string,
    requestedSize = 20,
  ): Promise<ManagedServerActivity | null> {
    if (!serverId || !actor.id) throw new RangeError("A server and actor are required");
    if (cursor !== undefined && serverActivityCursor(cursor) !== cursor) {
      throw new RangeError("Invalid server activity cursor");
    }
    const pageSize = Number.isFinite(requestedSize)
      ? Math.min(Math.max(Math.floor(requestedSize), 1), 50)
      : 20;
    return db.transaction(
      async (tx) => {
        const [server] = await tx
          .select({ id: servers.id, name: servers.name })
          .from(servers)
          .where(
            and(
              eq(servers.id, serverId),
              actor.role === "admin" ? undefined : managedServerScope(actor.id),
            ),
          )
          .limit(1);
        // Missing and unauthorized servers have the same result. No audit read follows.
        if (!server) return null;

        const anchor = alias(auditEvents, "server_activity_anchor");
        // Resolve the anchor in SQL: PostgreSQL microsecond precision is preserved.
        // A missing, foreign-target or excluded-action anchor produces no rows.
        const before =
          cursor === undefined
            ? undefined
            : sql`
        (${auditEvents.createdAt}, ${auditEvents.id}) < (
          select ${anchor.createdAt}, ${anchor.id} from ${auditEvents} as ${sql.identifier("server_activity_anchor")}
          where ${anchor.id} = ${cursor} and ${anchor.targetType} = 'server'
            and ${anchor.targetId} = ${serverId}
            and ${inArray(anchor.action, [...SERVER_ACTIVITY_ACTIONS])}
        )`;
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            actorId: auditEvents.actorId,
            actorType: auditEvents.actorType,
            actorUsername: users.username,
            actorDisplayName: users.displayName,
            // Return only the bounded allowlist of field names, not the JSON payload.
            fields: sql<ServerActivityField[]>`coalesce((
          select jsonb_agg(field.name order by field.ordinal)
          from jsonb_array_elements_text(${JSON.stringify(SERVER_ACTIVITY_FIELDS)}::jsonb)
            with ordinality as field(name, ordinal)
          where case when jsonb_typeof(${auditEvents.details}->'fields') = 'array'
            then (${auditEvents.details}->'fields') else '[]'::jsonb end ? field.name
        ), '[]'::jsonb)`,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .leftJoin(
            users,
            and(eq(auditEvents.actorType, "user"), eq(users.id, auditEvents.actorId)),
          )
          .where(
            and(
              eq(auditEvents.targetType, "server"),
              eq(auditEvents.targetId, serverId),
              inArray(auditEvents.action, [...SERVER_ACTIVITY_ACTIONS]),
              before,
            ),
          )
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(pageSize + 1);
        const events = rows.slice(0, pageSize) as ServerActivityItem[];
        return {
          server,
          events,
          nextCursor: rows.length > pageSize ? events[events.length - 1].id : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

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

  async listByActor(actorId: string, actions: string[], limit = 50): Promise<AuditEvent[]> {
    if (actions.length === 0) return [];
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 50;
    const rows = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, actorId), inArray(auditEvents.action, actions)))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(boundedLimit);
    return rows as unknown as AuditEvent[];
  }
}

export const auditRepository = new AuditRepository();
