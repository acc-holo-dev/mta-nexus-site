import { setTimeout as delay } from "node:timers/promises";
import { closeDatabaseConnection, comments, db } from "@nexus/db";
import { and, asc, isNotNull, isNull, sql } from "drizzle-orm";
import { notifyDiscussionReplies } from "../src/lib/services/discussion-follow-notification-service";
import {
  type ReplayCheckpoint,
  replayDiscussionNotifications,
} from "../src/lib/services/discussion-notification-replay";
import { runDiscussionReplayWorker } from "../src/lib/services/discussion-replay-worker";
import { resolveDiscussionReplayDatabaseIdentity } from "./discussion-replay-database";
import { discussionReplayOptions } from "./discussion-replay-options";
import { withDiscussionReplayCheckpoint } from "./discussion-replay-storage";

// One checkpoint belongs to one database and one immutable UTC window.
const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
async function main() {
  const { checkpointName, from, until, limit, worker, adoptLegacy } = discussionReplayOptions(
    process.argv.slice(2),
  );
  const identity = await resolveDiscussionReplayDatabaseIdentity();
  await withDiscussionReplayCheckpoint(
    checkpointName,
    from,
    until,
    { identity, adoptLegacy },
    async (store) => {
      let checkpoint = store.initial;
      const save = async (value: ReplayCheckpoint) => {
        await store.save(value);
        checkpoint = value;
      };
      await save(checkpoint);
      const run = async () => {
        const started = performance.now();
        if ((await resolveDiscussionReplayDatabaseIdentity()) !== identity)
          throw Error("Replay database scope changed during recovery");
        const result = await replayDiscussionNotifications(
          checkpoint,
          {
            page: (cursor) =>
              db
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
                .limit(50),
            deliver: (contentId, commentId, cursor) =>
              notifyDiscussionReplies(contentId, commentId, { cursor, maxFollowerPages: 1 }),
            save,
            shouldStop: () => controller.signal.aborted,
          },
          limit,
        );
        console.log(
          JSON.stringify({
            processed: result.processed,
            blocked: result.blocked,
            completed: result.checkpoint.completed,
            audiencePending: !!result.checkpoint.pending,
            elapsedMs: Math.round(performance.now() - started),
            metrics: result.metrics,
          }),
        );
        return result;
      };
      if (worker) {
        await runDiscussionReplayWorker({
          run,
          stopped: () => controller.signal.aborted,
          wait: async (milliseconds) => {
            try {
              await delay(milliseconds, undefined, { signal: controller.signal });
            } catch (error) {
              if (!controller.signal.aborted) throw error;
            }
          },
          reportFailure: () =>
            console.warn("Discussion replay paused; retrying from retained checkpoint."),
        });
      } else {
        const result = await run();
        if (result.blocked) process.exitCode = 1;
      }
    },
  );
}
try {
  await main();
} catch {
  console.error(
    "Discussion replay failed; checkpoint retained. Check arguments, lock, database scope and legacy adoption.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection();
}
