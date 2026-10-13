import { comments, db, readDatabaseUrl } from "@nexus/db";
import { and, asc, isNotNull, isNull, sql } from "drizzle-orm";
import type { ReplayCursor } from "../src/lib/services/discussion-notification-replay";
import { replayTimestamp } from "../src/lib/services/discussion-replay-checkpoint";
import { discussionReplayDatabaseIdentity } from "./discussion-replay-options";

/** Read only metadata for the exact unqualified relations used by replay/dispatch. */
export async function resolveDiscussionReplayDatabaseIdentity(
  repairPush = false,
  database: Pick<typeof db, "execute"> = db,
) {
  const [scope] = await database.execute(sql`select pg_catalog.current_database() as "databaseName",
    (select oid::text from pg_catalog.pg_database where datname = pg_catalog.current_database()) as "databaseOid",
    pg_catalog.to_regclass('comments')::oid::text as "commentsOid",
    pg_catalog.to_regclass('follows')::oid::text as "followsOid"
    ${
      repairPush
        ? sql`,pg_catalog.to_regclass('notifications')::oid::text as "notificationsOid",
    pg_catalog.to_regclass('notification_preferences')::oid::text as "preferencesOid",
    pg_catalog.to_regclass('web_push_subscriptions')::oid::text as "subscriptionsOid",
    pg_catalog.to_regclass('web_push_outbox')::oid::text as "outboxOid",
    pg_catalog.to_regclass('web_push_queue_gate')::oid::text as "gateOid",
    pg_catalog.to_regclass('sessions')::oid::text as "sessionsOid"`
        : sql``
    }`);
  if (!scope) throw Error("Replay database scope unavailable");
  return discussionReplayDatabaseIdentity(readDatabaseUrl(), {
    databaseName: scope.databaseName,
    databaseOid: scope.databaseOid,
    commentsOid: scope.commentsOid,
    followsOid: scope.followsOid,
    ...(repairPush
      ? {
          repairRelationOids: [
            scope.notificationsOid,
            scope.preferencesOid,
            scope.subscriptionsOid,
            scope.outboxOid,
            scope.gateOid,
            scope.sessionsOid,
          ],
        }
      : {}),
  });
}

/** Reject an open window before touching checkpoints; retain PostgreSQL's microsecond precision. */
export async function assertDiscussionReplayClosedWindow(
  until: string,
  database: Pick<typeof db, "execute"> = db,
) {
  replayTimestamp(until);
  const [clock] = await database.execute(sql`select to_char(pg_catalog.statement_timestamp()
    at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "serverNow"`);
  const serverNow = replayTimestamp(clock?.serverNow);
  if (until > serverNow) throw Error("Replay window must end at or before database time");
  return serverNow;
}

/** Identical source bounds/order for delivery and preview; bounded rows without a full-history count. */
export function readDiscussionReplayPage(
  from: string,
  until: string,
  cursor: ReplayCursor | null,
  limit = 50,
  database: Pick<typeof db, "select"> = db,
) {
  replayTimestamp(from);
  replayTimestamp(until);
  if (from > until || !Number.isSafeInteger(limit) || limit < 1 || limit > 10001)
    throw Error("Invalid replay page bounds");
  if (cursor) replayTimestamp(cursor.createdAt);
  return database
    .select({
      id: comments.id,
      contentId: sql<string>`${comments.contentId}`,
      createdAt: sql<string>`to_char(${comments.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(comments)
    .where(
      and(
        isNotNull(comments.contentId),
        isNull(comments.productId),
        sql`${comments.createdAt} >= ${from}::timestamptz AND ${comments.createdAt} <= ${until}::timestamptz`,
        cursor
          ? sql`(${comments.createdAt},${comments.id}) > (${cursor.createdAt}::timestamptz,${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(limit);
}

/** Whole-window diagnostic, independent of saved progress; never creates or reads checkpoint files. */
export async function previewDiscussionReplay(options: {
  from: string;
  until: string;
  limit: number;
  repairPush: boolean;
}) {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 10000)
    throw Error("Invalid replay preview budget");
  return db.transaction(
    async (transaction) => {
      await resolveDiscussionReplayDatabaseIdentity(options.repairPush, transaction);
      const serverNow = await assertDiscussionReplayClosedWindow(options.until, transaction);
      const rows = await readDiscussionReplayPage(
        options.from,
        options.until,
        null,
        options.limit + 1,
        transaction,
      );
      return {
        dryRun: true,
        deliveryPolicy: options.repairPush ? "inbox-and-pending-push" : "inbox",
        from: options.from,
        until: options.until,
        serverNow,
        limit: options.limit,
        matchingComments: Math.min(rows.length, options.limit),
        hasMore: rows.length > options.limit,
        checkpoint: "ignored",
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
