import { setTimeout as delay } from "node:timers/promises";
import { closeDatabaseConnection } from "@nexus/db";
import { notifyDiscussionReplies } from "../src/lib/services/discussion-follow-notification-service";
import {
  type ReplayCheckpoint,
  replayDiscussionNotifications,
} from "../src/lib/services/discussion-notification-replay";
import {
  DiscussionReplayPermanentError,
  runDiscussionReplayWorker,
} from "../src/lib/services/discussion-replay-worker";
import {
  assertDiscussionReplayClosedWindow,
  previewDiscussionReplay,
  readDiscussionReplayPage,
  resolveDiscussionReplayDatabaseIdentity,
} from "./discussion-replay-database";
import { discussionReplayOptions } from "./discussion-replay-options";
import { withDiscussionReplayCheckpoint } from "./discussion-replay-storage";

// One checkpoint belongs to one database and one immutable UTC window.
const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
async function main() {
  const { checkpointName, from, until, limit, worker, adoptLegacy, repairPush, dryRun } =
    discussionReplayOptions(process.argv.slice(2));
  if (dryRun) {
    console.log(JSON.stringify(await previewDiscussionReplay({ from, until, limit, repairPush })));
    return;
  }
  const identity = await resolveDiscussionReplayDatabaseIdentity(repairPush);
  await assertDiscussionReplayClosedWindow(until);
  await withDiscussionReplayCheckpoint(
    checkpointName,
    from,
    until,
    { identity, adoptLegacy, deliveryPolicy: repairPush ? "inbox-and-pending-push" : "inbox" },
    async (store) => {
      let checkpoint = store.initial;
      const save = async (value: ReplayCheckpoint) => {
        try {
          await store.save(value);
        } catch (error) {
          throw new DiscussionReplayPermanentError("Replay checkpoint write failed", {
            cause: error,
          });
        }
        checkpoint = value;
      };
      await save(checkpoint);
      const run = async () => {
        const started = performance.now();
        if ((await resolveDiscussionReplayDatabaseIdentity(repairPush)) !== identity)
          throw Error("Replay database scope changed during recovery");
        await assertDiscussionReplayClosedWindow(until);
        const result = await replayDiscussionNotifications(
          checkpoint,
          {
            page: (cursor) => readDiscussionReplayPage(from, until, cursor),
            deliver: (contentId, commentId, cursor) =>
              notifyDiscussionReplies(contentId, commentId, {
                cursor,
                maxFollowerPages: 1,
                ...(repairPush ? { repairPush: true } : {}),
              }),
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
    "Discussion replay failed. Existing checkpoint retained; check arguments, closed window, lock, database scope and legacy adoption.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection();
}
