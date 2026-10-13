import { db, readDatabaseUrl } from "@nexus/db";
import { sql } from "drizzle-orm";
import { discussionReplayDatabaseIdentity } from "./discussion-replay-options";

/** Read only metadata for the exact unqualified relations used by replay/dispatch. */
export async function resolveDiscussionReplayDatabaseIdentity(repairPush = false) {
  const [scope] = await db.execute(sql`select pg_catalog.current_database() as "databaseName",
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
