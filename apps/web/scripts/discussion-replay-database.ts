import { db, readDatabaseUrl } from "@nexus/db";
import { sql } from "drizzle-orm";
import { discussionReplayDatabaseIdentity } from "./discussion-replay-options";

/** Read only metadata for the exact unqualified relations used by replay/dispatch. */
export async function resolveDiscussionReplayDatabaseIdentity() {
  const [scope] = await db.execute(sql`select pg_catalog.current_database() as "databaseName",
    (select oid::text from pg_catalog.pg_database where datname = pg_catalog.current_database()) as "databaseOid",
    pg_catalog.to_regclass('comments')::oid::text as "commentsOid",
    pg_catalog.to_regclass('follows')::oid::text as "followsOid"`);
  if (!scope) throw Error("Replay database scope unavailable");
  return discussionReplayDatabaseIdentity(readDatabaseUrl(), {
    databaseName: scope.databaseName,
    databaseOid: scope.databaseOid,
    commentsOid: scope.commentsOid,
    followsOid: scope.followsOid,
  });
}
