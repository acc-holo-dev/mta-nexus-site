import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import {
  discussionNotificationDeliveries,
  publicationNotificationDeliveries,
  reportNotificationDeliveries,
  supportNotificationDeliveries,
  verificationNotificationDeliveries,
  webPushAdmissionRecovery,
} from "../schema";

/** Matches fanout worker exhaustion and OPERATIONS operator reset SQL. */
const EXHAUSTED_ATTEMPTS = 5;

type ListedRow = Readonly<{
  id: string;
  attempts: number;
  availableAt: Date;
  createdAt: Date;
}>;

export type NotificationDeliveryOperatorChannelId =
  | "report"
  | "support"
  | "verification"
  | "discussion"
  | "publication"
  | "admission";

export type NotificationDeliveryExhaustedItem = Readonly<{
  channel: NotificationDeliveryOperatorChannelId;
  id: string;
  attempts: number;
  availableAt: string;
  createdAt: string;
}>;

export type NotificationDeliveryExhaustedSummary = Readonly<{
  channel: NotificationDeliveryOperatorChannelId;
  failed: number;
  items: readonly NotificationDeliveryExhaustedItem[];
}>;

const FANOUT = {
  report: {
    table: reportNotificationDeliveries,
    id: reportNotificationDeliveries.reportId,
    createdAt: reportNotificationDeliveries.createdAt,
    availableAt: reportNotificationDeliveries.availableAt,
    attempts: reportNotificationDeliveries.attempts,
    completedAt: reportNotificationDeliveries.completedAt,
  },
  support: {
    table: supportNotificationDeliveries,
    id: supportNotificationDeliveries.messageId,
    createdAt: supportNotificationDeliveries.createdAt,
    availableAt: supportNotificationDeliveries.availableAt,
    attempts: supportNotificationDeliveries.attempts,
    completedAt: supportNotificationDeliveries.completedAt,
  },
  verification: {
    table: verificationNotificationDeliveries,
    id: verificationNotificationDeliveries.verificationRequestId,
    createdAt: verificationNotificationDeliveries.createdAt,
    availableAt: verificationNotificationDeliveries.availableAt,
    attempts: verificationNotificationDeliveries.attempts,
    completedAt: verificationNotificationDeliveries.completedAt,
  },
  discussion: {
    table: discussionNotificationDeliveries,
    id: discussionNotificationDeliveries.commentId,
    createdAt: discussionNotificationDeliveries.createdAt,
    availableAt: discussionNotificationDeliveries.availableAt,
    attempts: discussionNotificationDeliveries.attempts,
    completedAt: discussionNotificationDeliveries.completedAt,
  },
  publication: {
    table: publicationNotificationDeliveries,
    id: publicationNotificationDeliveries.contentId,
    createdAt: publicationNotificationDeliveries.createdAt,
    availableAt: publicationNotificationDeliveries.availableAt,
    attempts: publicationNotificationDeliveries.attempts,
    completedAt: publicationNotificationDeliveries.completedAt,
  },
} as const;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function listFanout(
  channel: keyof typeof FANOUT,
  limit: number,
): Promise<NotificationDeliveryExhaustedSummary> {
  const spec = FANOUT[channel];
  const [countRow] = await db
    .select({
      failed: sql<number>`count(*)::int`,
    })
    .from(spec.table)
    .where(and(isNull(spec.completedAt), eq(spec.attempts, EXHAUSTED_ATTEMPTS)));
  const rows = (await db
    .select({
      id: spec.id,
      attempts: spec.attempts,
      availableAt: spec.availableAt,
      createdAt: spec.createdAt,
    })
    .from(spec.table)
    .where(and(isNull(spec.completedAt), eq(spec.attempts, EXHAUSTED_ATTEMPTS)))
    .orderBy(asc(spec.availableAt), asc(spec.id))
    .limit(limit)) as ListedRow[];
  return {
    channel,
    failed: Number(countRow?.failed ?? 0),
    items: rows.map((row) => ({
      channel,
      id: row.id,
      attempts: row.attempts,
      availableAt: toIso(row.availableAt),
      createdAt: toIso(row.createdAt),
    })),
  };
}

async function listAdmission(limit: number): Promise<NotificationDeliveryExhaustedSummary> {
  const [countRow] = await db
    .select({ failed: sql<number>`count(*)::int` })
    .from(webPushAdmissionRecovery)
    .where(eq(webPushAdmissionRecovery.attempts, EXHAUSTED_ATTEMPTS));
  const rows = (await db
    .select({
      id: webPushAdmissionRecovery.notificationId,
      attempts: webPushAdmissionRecovery.attempts,
      availableAt: webPushAdmissionRecovery.availableAt,
      createdAt: webPushAdmissionRecovery.createdAt,
    })
    .from(webPushAdmissionRecovery)
    .where(eq(webPushAdmissionRecovery.attempts, EXHAUSTED_ATTEMPTS))
    .orderBy(
      asc(webPushAdmissionRecovery.availableAt),
      asc(webPushAdmissionRecovery.notificationId),
    )
    .limit(limit)) as ListedRow[];
  return {
    channel: "admission",
    failed: Number(countRow?.failed ?? 0),
    items: rows.map((row) => ({
      channel: "admission",
      id: row.id,
      attempts: row.attempts,
      availableAt: toIso(row.availableAt),
      createdAt: toIso(row.createdAt),
    })),
  };
}

export async function listExhaustedNotificationDeliveries(options: {
  channel?: NotificationDeliveryOperatorChannelId | null;
  limit: number;
}): Promise<readonly NotificationDeliveryExhaustedSummary[]> {
  const channels: NotificationDeliveryOperatorChannelId[] = options.channel
    ? [options.channel]
    : ["report", "support", "verification", "discussion", "publication", "admission"];
  const summaries: NotificationDeliveryExhaustedSummary[] = [];
  for (const channel of channels) {
    summaries.push(
      channel === "admission"
        ? await listAdmission(options.limit)
        : await listFanout(channel, options.limit),
    );
  }
  return summaries;
}

export type NotificationDeliveryResetResult = Readonly<{
  channel: NotificationDeliveryOperatorChannelId;
  id: string;
  reset: boolean;
}>;

export async function resetExhaustedNotificationDelivery(
  channel: NotificationDeliveryOperatorChannelId,
  id: string,
): Promise<NotificationDeliveryResetResult> {
  if (channel === "admission") {
    const rows = await db
      .update(webPushAdmissionRecovery)
      .set({
        attempts: 0,
        availableAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(webPushAdmissionRecovery.notificationId, id),
          eq(webPushAdmissionRecovery.attempts, EXHAUSTED_ATTEMPTS),
          sql`${webPushAdmissionRecovery.createdAt} > clock_timestamp() - interval '24 hours'`,
        ),
      )
      .returning({ id: webPushAdmissionRecovery.notificationId });
    return { channel, id, reset: rows.length === 1 };
  }

  const spec = FANOUT[channel];
  const rows = await db
    .update(spec.table)
    .set({
      attempts: 0,
      availableAt: sql`clock_timestamp()`,
    })
    .where(and(eq(spec.id, id), eq(spec.attempts, EXHAUSTED_ATTEMPTS), isNull(spec.completedAt)))
    .returning({ id: spec.id });
  return { channel, id, reset: rows.length === 1 };
}
