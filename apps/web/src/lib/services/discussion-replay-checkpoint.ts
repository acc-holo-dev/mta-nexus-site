import type { ReplayCheckpoint, ReplayCursor } from "./discussion-notification-replay";

export function replayTimestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value))
    throw Error("Use UTC timestamps with six fractional digits");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== `${value.slice(0, 23)}Z`)
    throw Error("Invalid UTC calendar timestamp");
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid checkpoint record");
  return value as Record<string, unknown>;
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw Error("Invalid checkpoint identifier");
  return value;
}
function cursor(value: unknown): ReplayCursor {
  const item = record(value);
  return { id: identifier(item.id), createdAt: replayTimestamp(item.createdAt) };
}
function after(left: ReplayCursor, right: ReplayCursor) {
  return (
    left.createdAt > right.createdAt || (left.createdAt === right.createdAt && left.id > right.id)
  );
}
export function parseDiscussionReplayCheckpoint(
  value: unknown,
  from: string,
  until: string,
): ReplayCheckpoint {
  replayTimestamp(from);
  replayTimestamp(until);
  const saved = record(value);
  if (
    from > until ||
    saved.version !== 1 ||
    saved.from !== from ||
    saved.until !== until ||
    typeof saved.completed !== "boolean"
  )
    throw Error("Checkpoint does not match replay window");
  const current = saved.cursor === null ? null : cursor(saved.cursor);
  const inWindow = (time: string) => time >= from && time <= until;
  if (current && !inWindow(current.createdAt)) throw Error("Checkpoint cursor outside window");
  const result: ReplayCheckpoint = {
    version: 1,
    from,
    until,
    cursor: current,
    completed: saved.completed,
  };
  if (saved.pending !== undefined) {
    const pending = cursor(saved.pending),
      item = record(saved.pending);
    const audienceCursor = cursor(item.audienceCursor);
    if (
      saved.completed ||
      !inWindow(pending.createdAt) ||
      (current && !after(pending, current)) ||
      audienceCursor.createdAt > pending.createdAt
    )
      throw Error("Invalid pending audience checkpoint");
    result.pending = { ...pending, contentId: identifier(item.contentId), audienceCursor };
  }
  return result;
}
