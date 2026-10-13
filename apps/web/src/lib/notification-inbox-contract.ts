import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
export const INBOX_CATEGORIES = [
  "follow",
  "content",
  "server",
  "commerce",
  "system",
  "security",
] as const;
export const INBOX_PERIODS = ["all", "7", "30", "90", "365"] as const;
const id = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
  );
const cursorSchema = discussionCursorSchema
  .extend({
    id,
    createdAt: discussionCursorSchema.shape.createdAt.refine((value) => /\.\d{6}Z$/u.test(value)),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    direction: z.enum(["older", "newer"]),
    version: z.literal(1),
    asOf: discussionCursorSchema.shape.createdAt
      .refine((value) => /\.\d{6}Z$/u.test(value))
      .optional(),
  })
  .strict();
export function parseNotificationInboxQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) =>
        !["q", "state", "category", "period", "at", "cursor"].includes(key) ||
        params.getAll(key).length !== 1,
    )
  )
    return null;
  const raw = params.get("q") ?? "",
    query = raw.trim(),
    state = params.get("state") || "all",
    category = params.get("category") || "all",
    period = params.get("period") ?? "all";
  if (
    raw.length > 100 ||
    Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !["all", "read", "unread"].includes(state) ||
    (category !== "all" && !(INBOX_CATEGORIES as readonly string[]).includes(category)) ||
    !(INBOX_PERIODS as readonly string[]).includes(period)
  )
    return null;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (params.has("cursor")) {
    const rawCursor = params.get("cursor") ?? "";
    if (rawCursor.length > 2048) return null;
    try {
      const parsed = cursorSchema.safeParse(JSON.parse(rawCursor));
      if (!parsed.success) return null;
      cursor = parsed.data;
    } catch {
      return null;
    }
  }
  let at: string | undefined;
  if (params.has("at")) {
    const parsed = cursorSchema.shape.createdAt.safeParse(params.get("at"));
    if (!parsed.success || parsed.data.startsWith("0000")) return null;
    at = parsed.data;
  }
  if (
    (period === "all" && (at !== undefined || cursor?.asOf !== undefined)) ||
    (period !== "all" && cursor && !cursor.asOf) ||
    (cursor?.asOf && (cursor.asOf.startsWith("0000") || (at !== undefined && at !== cursor.asOf)))
  )
    return null;
  return {
    query,
    state: state as "all" | "read" | "unread",
    category: category as "all" | (typeof INBOX_CATEGORIES)[number],
    cursor,
    period: period as (typeof INBOX_PERIODS)[number],
    at,
  };
}
type ParsedQuery = NonNullable<ReturnType<typeof parseNotificationInboxQuery>>;
export type NotificationInboxQuery = Omit<ParsedQuery, "cursor" | "period" | "at"> &
  Partial<Pick<ParsedQuery, "cursor" | "period" | "at">>;
export function notificationInboxHref(
  path: string,
  filters: NotificationInboxQuery,
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.state !== "all") params.set("state", filters.state);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.period && filters.period !== "all") params.set("period", filters.period);
  if (filters.at && filters.period && filters.period !== "all") params.set("at", filters.at);
  if (cursor) params.set("cursor", cursor);
  return `${path}${params.size ? `?${params}` : ""}`;
}
export const notificationInboxCommandSchema = z
  .object({
    isRead: z.boolean(),
    items: z
      .array(z.object({ id, expectedIsRead: z.boolean() }).strict())
      .min(1)
      .max(25),
  })
  .strict()
  .refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length);
export const notificationInboxPageSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id,
            title: z.string().max(1024),
            message: z.string().max(16384),
            link: z.string().max(2048).nullable(),
            category: z.enum(INBOX_CATEGORIES),
            isRead: z.boolean(),
            createdAt: cursorSchema.shape.createdAt,
            truncated: z.boolean(),
          })
          .strict(),
      )
      .max(25),
    unreadCount: z.number().int().nonnegative(),
    olderCursor: z.string().max(2048).nullable(),
    newerCursor: z.string().max(2048).nullable(),
    window: z
      .object({
        from: cursorSchema.shape.createdAt,
        until: cursorSchema.shape.createdAt,
      })
      .strict()
      .refine((value) => value.from <= value.until)
      .optional(),
  })
  .strict();
export type NotificationInboxPage = z.infer<typeof notificationInboxPageSchema>;
export function confirmedNotificationInboxCommand(
  value: unknown,
  command: z.infer<typeof notificationInboxCommandSchema>,
) {
  const parsed = z
    .object({ isRead: z.boolean(), ids: z.array(id).min(1).max(25) })
    .strict()
    .safeParse(value);
  return (
    parsed.success &&
    parsed.data.isRead === command.isRead &&
    parsed.data.ids.length === command.items.length &&
    new Set(parsed.data.ids).size === parsed.data.ids.length &&
    command.items.every((item) => parsed.data.ids.includes(item.id))
  );
}
