import { createHash } from "node:crypto";
import {
  AppError,
  type AuditEvent,
  SECURITY_LICENSE_SUBJECT_ACTIONS,
  SECURITY_SERVER_VERIFICATION_SUBJECT_ACTIONS,
  SECURITY_SUBJECT_DETAIL_KEYS,
  SECURITY_SUPPORT_CASE_SUBJECT_ACTIONS,
  SECURITY_VERIFICATION_SUBJECT_ACTIONS,
  SERVER_ACTIVITY_ACTIONS,
  SERVER_ACTIVITY_FIELDS,
  type ServerActivityAction,
  type ServerActivityField,
  serverActivityCursor,
  type User,
} from "@nexus/domain";
import { and, desc, eq, exists, inArray, ne, or, sql } from "drizzle-orm";
import { type AnyPgColumn, alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import {
  auditEvents,
  licenses,
  servers,
  supportCases,
  users,
  verificationRequests,
} from "../schema";
import { serverContentContext } from "./server-content";
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

type HistoryAction = "all" | "listing" | "visibility" | "control" | "verification";
type HistoryCursor = { context: string; until: string; id: string };
const safeServerActivityFields = sql<ServerActivityField[]>`coalesce((
          select jsonb_agg(field.name order by field.ordinal)
          from jsonb_array_elements_text(${JSON.stringify(SERVER_ACTIVITY_FIELDS)}::jsonb)
            with ordinality as field(name, ordinal)
          where case when jsonb_typeof(${auditEvents.details}->'fields') = 'array'
            then (${auditEvents.details}->'fields') else '[]'::jsonb end ? field.name
        ), '[]'::jsonb)`;
function serverHistoryAction(
  table: { action: AnyPgColumn; details: AnyPgColumn },
  action: HistoryAction,
) {
  if (action === "listing") return inArray(table.action, ["server.created", "server.updated"]);
  if (action === "visibility")
    return and(
      eq(table.action, "server.updated"),
      sql`case when jsonb_typeof(${table.details}->'fields')='array' then (${table.details}->'fields') else '[]'::jsonb end ? 'visibility'`,
    );
  if (action === "control")
    return inArray(table.action, [
      "server.claim_challenge_issued",
      "server.control_proof_recorded",
    ]);
  if (action === "verification")
    return inArray(table.action, ["server.verification_approved", "server.verification_rejected"]);
  return inArray(table.action, [...SERVER_ACTIVITY_ACTIONS]);
}
export class AuditRepository {
  async managedServerHistory(
    serverId: string,
    actorId: string,
    filters: {
      period: "all" | "7" | "30" | "90" | "365";
      action: HistoryAction;
      cursor?: HistoryCursor;
      legacyCursor?: string;
      until?: string;
    },
  ) {
    if (
      !/^[A-Za-z0-9_-]{1,128}$/u.test(serverId) ||
      !/^[A-Za-z0-9_-]{1,128}$/u.test(actorId) ||
      !["all", "7", "30", "90", "365"].includes(filters.period) ||
      !["all", "listing", "visibility", "control", "verification"].includes(filters.action)
    )
      throw new AppError("Invalid server history filters", 400, "SERVER_HISTORY_FILTER_INVALID");
    const context = createHash("sha256")
      .update(
        JSON.stringify([
          1,
          "server-management-history",
          actorId,
          serverId,
          filters.period,
          filters.action,
        ]),
      )
      .digest("hex");
    return db.transaction(
      async (tx) => {
        const current = await serverContentContext(tx, serverId, actorId);
        if (
          filters.cursor &&
          (filters.cursor.context !== context ||
            !/^[A-Za-z0-9_-]{1,128}$/u.test(filters.cursor.id) ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(filters.cursor.until))
        )
          throw new AppError("History context changed", 400, "INVALID_CURSOR");
        if (
          filters.legacyCursor &&
          (serverActivityCursor(filters.legacyCursor) !== filters.legacyCursor ||
            filters.cursor ||
            filters.action !== "all" ||
            filters.period !== "all")
        )
          throw new AppError("Invalid server history cursor", 400, "INVALID_CURSOR");
        const [clock] = await tx
          .select({
            until: sql<string>`to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(sql`(select 1) as server_history_clock`)
          .limit(1);
        if (!clock) throw new Error("Database clock unavailable");
        if (
          filters.until &&
          (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(filters.until) ||
            (filters.cursor && filters.cursor.until !== filters.until))
        )
          throw new AppError("Invalid server history window", 400, "INVALID_CURSOR");
        const until = filters.cursor?.until ?? filters.until ?? clock.until;
        if (until > clock.until)
          throw new AppError("Invalid server history window", 400, "INVALID_CURSOR");
        const bounds = (table: {
          action: AnyPgColumn;
          details: AnyPgColumn;
          createdAt: AnyPgColumn;
          targetType: AnyPgColumn;
          targetId: AnyPgColumn;
        }) =>
          and(
            eq(table.targetType, "server"),
            eq(table.targetId, serverId),
            serverHistoryAction(table, filters.action),
            sql`${table.createdAt} <= ${until}::timestamptz`,
            filters.period !== "all"
              ? sql`${table.createdAt} >= ${until}::timestamptz-(${Number(filters.period)} * interval '1 day')`
              : undefined,
          );
        const anchor = alias(auditEvents, "server_history_anchor"),
          beforeId = filters.cursor?.id ?? filters.legacyCursor;
        const before = beforeId
          ? sql`(${auditEvents.createdAt},${auditEvents.id}) < (select ${anchor.createdAt},${anchor.id} from ${auditEvents} as ${sql.identifier("server_history_anchor")} where ${anchor.id}=${beforeId} and ${bounds(anchor)})`
          : undefined;
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            actorId: auditEvents.actorId,
            actorType: auditEvents.actorType,
            actorUsername: sql<
              string | null
            >`case when ${auditEvents.actorType} in ('user','admin') then left(${users.username},64) else null end`,
            actorDisplayName: sql<
              string | null
            >`case when ${auditEvents.actorType} in ('user','admin') then left(coalesce(${users.displayName},${users.username}),128) else null end`,
            fields: safeServerActivityFields,
            createdAt: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            fromVisibility: sql<
              string | null
            >`case when ${auditEvents.action}='server.updated' and ${auditEvents.details}->>'previousVisibility' in ('public','unlisted','private') and ${auditEvents.details}->>'visibility' in ('public','unlisted','private') then ${auditEvents.details}->>'previousVisibility' else null end`,
            toVisibility: sql<
              string | null
            >`case when ${auditEvents.action}='server.updated' and ${auditEvents.details}->>'previousVisibility' in ('public','unlisted','private') and ${auditEvents.details}->>'visibility' in ('public','unlisted','private') then ${auditEvents.details}->>'visibility' else null end`,
          })
          .from(auditEvents)
          .leftJoin(
            users,
            and(
              inArray(auditEvents.actorType, ["user", "admin"]),
              eq(users.id, auditEvents.actorId),
            ),
          )
          .where(and(bounds(auditEvents), before))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        const events = rows.slice(0, 20),
          last = events.at(-1);
        return {
          server: { id: current.id, name: Array.from(current.name).slice(0, 200).join("") },
          until,
          period: filters.period,
          action: filters.action,
          events,
          nextCursor: rows.length > 20 && last ? { context, until, id: last.id } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

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
              or(
                managedServerScope(actor.id),
                exists(
                  tx
                    .select({ id: users.id })
                    .from(users)
                    .where(and(eq(users.id, actor.id), eq(users.role, "admin"))),
                ),
              ),
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
            fields: safeServerActivityFields,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .leftJoin(
            users,
            and(
              inArray(auditEvents.actorType, ["user", "admin"]),
              eq(users.id, auditEvents.actorId),
            ),
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

  async listAccountActivity(
    userId: string,
    actorActions: readonly string[],
    limit = 50,
  ): Promise<AuditEvent[]> {
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(userId)) {
      throw new AppError(
        "Invalid security activity account",
        400,
        "SECURITY_ACTIVITY_ACCOUNT_INVALID",
      );
    }
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 50;
    const actorScope =
      actorActions.length > 0
        ? and(eq(auditEvents.actorId, userId), inArray(auditEvents.action, [...actorActions]))
        : undefined;
    const organizationSubjectScope = or(
      ...Object.entries(SECURITY_SUBJECT_DETAIL_KEYS).map(([action, detailKey]) =>
        and(eq(auditEvents.action, action), sql`${auditEvents.details}->>${detailKey} = ${userId}`),
      ),
    );
    const licenseSubjectScope = and(
      inArray(auditEvents.action, [...SECURITY_LICENSE_SUBJECT_ACTIONS]),
      eq(auditEvents.targetType, "license"),
      exists(
        db
          .select({ id: licenses.id })
          .from(licenses)
          .where(and(eq(licenses.id, auditEvents.targetId), eq(licenses.userId, userId))),
      ),
    );
    const supportCaseSubjectScope = and(
      inArray(auditEvents.action, [...SECURITY_SUPPORT_CASE_SUBJECT_ACTIONS]),
      eq(auditEvents.targetType, "support_case"),
      exists(
        db
          .select({ id: supportCases.id })
          .from(supportCases)
          .where(
            and(eq(supportCases.id, auditEvents.targetId), eq(supportCases.requesterId, userId)),
          ),
      ),
    );
    const verificationSubjectScope = and(
      inArray(auditEvents.action, [...SECURITY_VERIFICATION_SUBJECT_ACTIONS]),
      eq(auditEvents.targetType, "verification"),
      exists(
        db
          .select({ id: verificationRequests.id })
          .from(verificationRequests)
          .where(
            and(
              eq(verificationRequests.id, auditEvents.targetId),
              eq(verificationRequests.requesterId, userId),
            ),
          ),
      ),
    );
    const serverVerificationSubjectScope = and(
      inArray(auditEvents.action, [...SECURITY_SERVER_VERIFICATION_SUBJECT_ACTIONS]),
      eq(auditEvents.targetType, "server"),
      exists(
        db
          .select({ id: verificationRequests.id })
          .from(verificationRequests)
          .where(
            and(
              eq(verificationRequests.requesterId, userId),
              eq(verificationRequests.targetType, "server"),
              eq(verificationRequests.targetId, auditEvents.targetId),
              sql`${auditEvents.id} = concat('aud_server_verification_', ${verificationRequests.id})`,
            ),
          ),
      ),
    );
    const subjectScope = and(
      ne(auditEvents.actorId, userId),
      or(
        organizationSubjectScope,
        licenseSubjectScope,
        supportCaseSubjectScope,
        verificationSubjectScope,
        serverVerificationSubjectScope,
      ),
    );
    const rows = await db
      .select({
        id: auditEvents.id,
        actorId: auditEvents.actorId,
        actorType: auditEvents.actorType,
        action: auditEvents.action,
        targetId: auditEvents.targetId,
        targetType: auditEvents.targetType,
        ipAddress: auditEvents.ipAddress,
        userAgent: auditEvents.userAgent,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(actorScope ? or(actorScope, subjectScope) : subjectScope)
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(boundedLimit);
    return rows as AuditEvent[];
  }
}

export const auditRepository = new AuditRepository();
