export type ReplayCursor = { createdAt: string; id: string };
export type ReplayCheckpoint = {
  version: 1;
  from: string;
  until: string;
  cursor: ReplayCursor | null;
  completed: boolean;
};

/** Advance only after the entire audience succeeded. A crash replays the current event. */
export async function replayDiscussionNotifications(
  checkpoint: ReplayCheckpoint,
  dependencies: {
    page: (cursor: ReplayCursor | null) => Promise<Array<ReplayCursor & { contentId: string }>>;
    deliver: (contentId: string, commentId: string) => Promise<{ failed: number }>;
    save: (checkpoint: ReplayCheckpoint) => Promise<void>;
    shouldStop?: () => boolean;
  },
  limit: number,
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000)
    throw Error("Replay limit must be between 1 and 10000");
  let current = { ...checkpoint };
  let processed = 0;
  while (!current.completed && processed < limit && !dependencies.shouldStop?.()) {
    const rows = await dependencies.page(current.cursor);
    if (!rows.length) {
      current = { ...current, completed: true };
      await dependencies.save(current);
      break;
    }
    for (const row of rows) {
      if (processed >= limit || dependencies.shouldStop?.()) break;
      if (
        row.createdAt < current.from ||
        row.createdAt > current.until ||
        (current.cursor &&
          (row.createdAt < current.cursor.createdAt ||
            (row.createdAt === current.cursor.createdAt && row.id <= current.cursor.id)))
      )
        throw Error("Replay page is outside its window or does not advance");
      const result = await dependencies.deliver(row.contentId, row.id);
      if (result.failed) return { checkpoint: current, processed, blocked: true };
      current = { ...current, cursor: { createdAt: row.createdAt, id: row.id } };
      await dependencies.save(current);
      processed++;
    }
  }
  return { checkpoint: current, processed, blocked: false };
}
