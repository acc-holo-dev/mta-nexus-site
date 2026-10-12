import { createHash } from "node:crypto";
import { AppError, CHANGE_HISTORY_PERIODS, type ChangeHistoryFilters } from "@nexus/domain";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { db } from "../client";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
function validChangeHistoryTime(value: string) {
  if (value.startsWith("0000") || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value))
    return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19);
}
export function changeHistoryContext<Group extends string>(
  scope: string,
  actorId: string,
  targetId: string,
  groups: readonly Group[],
  filters: ChangeHistoryFilters<Group>,
) {
  const id = (value: string) => /^[A-Za-z0-9_-]{1,128}$/u.test(value);
  if (
    !id(actorId) ||
    !id(targetId) ||
    !CHANGE_HISTORY_PERIODS.includes(filters.period) ||
    !groups.includes(filters.group) ||
    typeof filters.query !== "string" ||
    filters.query.length > 80 ||
    filters.query !== filters.query.trim()
  )
    throw new AppError("Invalid history filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
  const context = createHash("sha256")
    .update(
      JSON.stringify([1, scope, actorId, targetId, filters.period, filters.group, filters.query]),
    )
    .digest("hex");
  if (
    (filters.cursor &&
      (!id(filters.cursor.id) ||
        filters.cursor.version !== 1 ||
        filters.cursor.context !== context ||
        !validChangeHistoryTime(filters.cursor.until))) ||
    (filters.before !== undefined &&
      (!id(filters.before) ||
        filters.cursor ||
        filters.group !== "all" ||
        filters.period !== "all" ||
        filters.query)) ||
    (filters.until !== undefined &&
      (!validChangeHistoryTime(filters.until) ||
        (filters.cursor && filters.until !== filters.cursor.until)))
  )
    throw new AppError("History context changed", 400, "INVALID_CURSOR");
  return context;
}
export async function changeHistoryWindow<Group extends string>(
  tx: Tx,
  filters: ChangeHistoryFilters<Group>,
) {
  const [clock] = await tx
    .select({
      until: sql<string>`to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(sql`(select 1) as change_history_clock`)
    .limit(1);
  if (!clock || !validChangeHistoryTime(clock.until))
    throw new AppError("History clock unavailable", 503, "INTERNAL_ERROR");
  const until = filters.cursor?.until ?? filters.until ?? clock.until;
  if (until > clock.until)
    throw new AppError("History window is in the future", 400, "INVALID_CURSOR");
  return until;
}
export function changeHistoryBounds(
  column: AnyPgColumn,
  period: ChangeHistoryFilters<string>["period"],
  until: string,
) {
  return sql`${column}<=${until}::timestamptz ${period === "all" ? sql`` : sql`and ${column}>=${until}::timestamptz-(${Number(period)} * interval '1 day')`}`;
}
