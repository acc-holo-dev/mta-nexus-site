import { open, readFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { closeDatabaseConnection, comments, db } from "@nexus/db";
import { and, asc, isNotNull, isNull, sql } from "drizzle-orm";
import { notifyDiscussionReplies } from "../src/lib/services/discussion-follow-notification-service";
import {
  type ReplayCheckpoint,
  replayDiscussionNotifications,
} from "../src/lib/services/discussion-notification-replay";

// One checkpoint belongs to one database and one immutable UTC window.
const [checkpointName, fromInput, untilInput, limitInput = "100"] = process.argv.slice(2);
function timestamp(value: string | undefined) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw Error("Use UTC timestamps with six fractional digits");
  return value;
}
async function main() {
  if (!checkpointName) throw Error("Usage: checkpoint-file from until [max-comments]");
  const from = timestamp(fromInput),
    until = timestamp(untilInput);
  if (from > until) throw Error("Invalid replay window");
  const path = resolve(checkpointName);
  const lock = await open(`${path}.lock`, "wx", 0o600);
  try {
    let checkpoint: ReplayCheckpoint = { version: 1, from, until, cursor: null, completed: false };
    try {
      const saved = JSON.parse(await readFile(path, "utf8"));
      if (
        saved.version !== 1 ||
        saved.from !== from ||
        saved.until !== until ||
        typeof saved.completed !== "boolean" ||
        (saved.cursor !== null &&
          (!saved.cursor ||
            typeof saved.cursor.id !== "string" ||
            !saved.cursor.id ||
            timestamp(saved.cursor.createdAt) < from ||
            saved.cursor.createdAt > until))
      )
        throw Error("Checkpoint does not match the replay window");
      checkpoint = saved;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const save = async (value: ReplayCheckpoint) => {
      const temp = `${path}.${process.pid}.tmp`;
      const file = await open(temp, "w", 0o600);
      try {
        await file.writeFile(JSON.stringify(value));
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temp, path);
    };
    await save(checkpoint);
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
        deliver: notifyDiscussionReplies,
        save,
      },
      Number(limitInput),
    );
    console.log(
      JSON.stringify({
        processed: result.processed,
        blocked: result.blocked,
        completed: result.checkpoint.completed,
      }),
    );
    if (result.blocked) process.exitCode = 1;
  } finally {
    await lock.close();
    await unlink(`${path}.lock`);
  }
}
try {
  await main();
} catch {
  console.error(
    "Discussion replay failed; checkpoint retained. Check arguments, lock and database availability.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection();
}
