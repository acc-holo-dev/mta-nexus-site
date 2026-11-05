import { createHash, randomUUID } from "node:crypto";
import {
  communityReportsRepository,
  db,
  reportRepository,
  sessionRepository,
  webPushSubscriptionRepository,
} from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, vi } from "vitest";
import {
  reportNotificationDeliveryRepository as delivery,
  ReportNotificationDeliveryRepository,
} from "../../packages/db/src/repositories/report-notification-delivery";
import {
  auditEvents,
  content,
  reportNotificationDeliveries as jobs,
  notifications,
  reports,
  users,
  webPushOutbox,
} from "../../packages/db/src/schema";
import { setNotificationPreferencesForTest } from "./notification-preferences-fixture";

export {
  auditEvents,
  db,
  delivery,
  eq,
  jobs,
  notifications,
  ReportNotificationDeliveryRepository,
  reports,
  sessionRepository,
  setNotificationPreferencesForTest,
  sql,
  users,
  webPushOutbox,
  webPushSubscriptionRepository,
};

const actors: string[] = [];
const reportIds: string[] = [];
const triggers: { table: string; name: string }[] = [];

export const id = (prefix: string) =>
  `${prefix}_report_delivery_${randomUUID().replaceAll("-", "")}`;

export const noticeId = (reportId: string, recipientId: string) =>
  `ntf_report_created_${createHash("sha256")
    .update(JSON.stringify([reportId, recipientId]))
    .digest("hex")}`;

/** Register shared afterEach cleanup for report notification delivery suites. */
export function setupReportNotificationDelivery() {
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const { table, name } of triggers.splice(0)) {
      await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
      await db.execute(sql.raw(`drop function if exists ${name}()`));
    }
    if (reportIds.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.targetId, reportIds));
      await db.delete(reports).where(inArray(reports.id, reportIds));
    }
    if (actors.length) await db.delete(users).where(inArray(users.id, actors));
    actors.length = 0;
    reportIds.length = 0;
  });
}

export async function actor(role = "user", prefix = "usr") {
  const userId = id(prefix);
  await db.insert(users).values({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Report delivery fixture",
    role,
    createdAt: new Date("2000-01-01T00:00:00Z"),
  });
  actors.push(userId);
  return userId;
}

export async function command(community = false) {
  const reporterId = await actor();
  await sessionRepository.create({
    id: `ses_${reporterId}`,
    userId: reporterId,
    token: `tok_${reporterId}`,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
  const reportId = id("rpt");
  const auditId = id("aud");
  reportIds.push(reportId);
  if (community) {
    const authorId = await actor();
    const contentId = id("cnt");
    await db.insert(content).values({
      id: contentId,
      slug: contentId,
      authorId,
      title: "PRIVATE_TARGET_TITLE",
      body: "PRIVATE_TARGET_BODY",
      status: "published",
    });
    const input = {
      actorId: reporterId,
      currentToken: `tok_${reporterId}`,
      id: reportId,
      auditId,
      targetType: "content" as const,
      targetId: contentId,
      type: "abuse",
      reason: "PRIVATE_REPORT_REASON",
      evidenceUrls: ["https://example.invalid/PRIVATE_EVIDENCE"],
    };
    return {
      reportId,
      auditId,
      reporterId,
      create: () => communityReportsRepository.submit(input),
    };
  }
  const targetId = await actor();
  const data = {
    id: reportId,
    reporterId,
    targetType: "user" as const,
    targetId,
    type: "scam" as const,
    reason: "PRIVATE_REPORT_REASON",
    evidenceUrls: ["https://example.invalid/PRIVATE_EVIDENCE"],
    status: "open" as const,
  };
  const audit = {
    id: auditId,
    actorId: reporterId,
    actorType: "user" as const,
    action: "report.created",
    targetType: "report",
    targetId: reportId,
    details: {},
  };
  return {
    reportId,
    auditId,
    reporterId,
    create: () => reportRepository.createWithAudit(data, audit, `tok_${reporterId}`),
  };
}

export async function job(community = false) {
  const fixture = await command(community);
  await fixture.create();
  // A synthetic horizon keeps retained moderators from other PG suites outside
  // this fixture. Production sources copy the report's exact database timestamp.
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.reportId, fixture.reportId));
  return fixture;
}

export async function source(reportId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.reportId, reportId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

export async function ready(reportId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.reportId, reportId));
}

export async function notices(reportId: string) {
  return db
    .select()
    .from(notifications)
    .where(sql`${notifications.id} in (
      select 'ntf_report_created_' || encode(sha256(convert_to(
        '[' || to_json(${reportId}::text)::text || ',' || to_json(id)::text || ']', 'UTF8')), 'hex')
      from users
    )`)
    .orderBy(asc(notifications.recipientId));
}

export async function drain(reportId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(reportId)).completedAt) return;
    await ready(reportId);
    const result = await delivery.processNext(limit);
    expect(["progress", "completed"]).toContain(result.state);
  }
  throw Error("Fixture delivery did not complete");
}

export async function failInsert(
  table: "report_notification_deliveries" | "notifications" | "web_push_outbox",
  value: string,
) {
  const column =
    table === "notifications"
      ? "recipient_id"
      : table === "web_push_outbox"
        ? "notification_id"
        : "report_id";
  const name = `report_delivery_failure_${randomUUID().replaceAll("-", "")}`;
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw Error("Unsafe fixture ID");
  await db.execute(
    sql.raw(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'PRIVATE_INSERT_FAILURE'; end $$`,
    ),
  );
  triggers.push({ table, name });
  await db.execute(
    sql.raw(
      `create trigger ${name} before insert on ${table} for each row when (new.${column} = '${value}') execute function ${name}()`,
    ),
  );
  return async () => {
    await db.execute(sql.raw(`drop trigger ${name} on ${table}`));
    await db.execute(sql.raw(`drop function ${name}()`));
    triggers.splice(
      triggers.findIndex((entry) => entry.name === name),
      1,
    );
  };
}

export function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
