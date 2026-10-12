import {
  CHANGE_HISTORY_PERIODS,
  type ChangeHistoryCursor,
  type ChangeHistoryFilters,
} from "@nexus/domain";
import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
export const changeHistoryTimeSchema = z.iso
  .datetime({ precision: 6 })
  .refine((value) => !value.startsWith("0000"));
const cursorSchema = z
  .object({
    version: z.literal(1),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    until: changeHistoryTimeSchema,
    id,
  })
  .strict();
export function parseChangeHistoryQuery<Group extends string>(
  params: URLSearchParams,
  groups: readonly Group[],
  search = false,
  legacy = false,
): ChangeHistoryFilters<Group> | null {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in raw || (!search && key === "q") || (key === "q" && value.length > 80)) return null;
    raw[key] = value;
  }
  const schema = z
    .object({
      period: z.enum(CHANGE_HISTORY_PERIODS).default("all"),
      group: z
        .string()
        .refine((value) => groups.includes(value as Group))
        .default("all"),
      q: z
        .string()
        .trim()
        .max(search ? 80 : 0)
        .default(""),
      cursor: z
        .string()
        .min(1)
        .max(2048)
        .regex(/^[A-Za-z0-9_-]+$/u)
        .optional(),
      until: changeHistoryTimeSchema.optional(),
      ...(legacy ? { before: id.optional() } : {}),
    })
    .strict();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return null;
  let cursor: ChangeHistoryCursor | undefined;
  if (parsed.data.cursor) {
    try {
      const decoded = Buffer.from(parsed.data.cursor, "base64url").toString("utf8"),
        value = cursorSchema.safeParse(JSON.parse(decoded));
      if (!value.success || Buffer.from(decoded).toString("base64url") !== parsed.data.cursor)
        return null;
      cursor = value.data;
    } catch {
      return null;
    }
  }
  const before = legacy ? raw.before : undefined;
  if (
    (before &&
      (cursor || parsed.data.period !== "all" || parsed.data.group !== "all" || parsed.data.q)) ||
    (parsed.data.until && cursor && parsed.data.until !== cursor.until)
  )
    return null;
  return {
    period: parsed.data.period,
    group: parsed.data.group as Group,
    query: parsed.data.q,
    cursor,
    before,
    until: parsed.data.until,
  };
}
export const encodeChangeHistoryCursor = (cursor: ChangeHistoryCursor) =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");
export function changeHistoryHref<Group extends string>(
  path: string,
  filters: ChangeHistoryFilters<Group>,
  options: { cursor?: string | null; until?: string; fresh?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (filters.period !== "all") params.set("period", filters.period);
  if (filters.group !== "all") params.set("group", filters.group);
  if (filters.query) params.set("q", filters.query);
  if (!options.fresh) {
    if (options.cursor) params.set("cursor", options.cursor);
    else if (filters.cursor) params.set("cursor", encodeChangeHistoryCursor(filters.cursor));
    else if (filters.before) params.set("before", filters.before);
    const until = options.until ?? filters.until;
    if (until) params.set("until", until);
  }
  return `${path}${params.size ? `?${params}` : ""}`;
}
