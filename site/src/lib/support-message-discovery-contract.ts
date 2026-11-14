import {
  SUPPORT_MESSAGE_GROUPS,
  type SupportMessageCursor,
  type SupportMessageFilters,
} from "@nexus/domain";
import { z } from "zod";
import { changeHistoryTimeSchema } from "./private-change-history-query";

const messageId = z.string().regex(/^spm_[a-f0-9]{24}$/u);
const cursorSchema = z
  .object({
    version: z.literal(1),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    until: changeHistoryTimeSchema,
    id: messageId,
    direction: z.enum(["older", "newer"]),
  })
  .strict();
export function parseSupportMessageQuery(params: URLSearchParams): SupportMessageFilters | null {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in raw || (key === "q" && value.length > 80)) return null;
    raw[key] = value;
  }
  const parsed = z
    .object({
      group: z.enum(SUPPORT_MESSAGE_GROUPS).default("all"),
      q: z.string().trim().max(80).default(""),
      cursor: z
        .string()
        .min(1)
        .max(2048)
        .regex(/^[A-Za-z0-9_-]+$/u)
        .optional(),
      until: changeHistoryTimeSchema.optional(),
      focus: messageId.optional(),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return null;
  let cursor: SupportMessageCursor | undefined;
  if (parsed.data.cursor)
    try {
      const decoded = Buffer.from(parsed.data.cursor, "base64url").toString("utf8");
      const value = cursorSchema.safeParse(JSON.parse(decoded));
      if (!value.success || Buffer.from(decoded).toString("base64url") !== parsed.data.cursor)
        return null;
      cursor = value.data;
    } catch {
      return null;
    }
  const { group, q: query, until, focus } = parsed.data;
  if (
    (cursor && until && until !== cursor.until) ||
    (focus && (cursor || query || group !== "all"))
  )
    return null;
  return { group, query, until, focus, cursor };
}
export const encodeSupportMessageCursor = (cursor: SupportMessageCursor) =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");
export function supportMessageHref(
  path: string,
  filters: SupportMessageFilters,
  options: { cursor?: SupportMessageCursor | null; until?: string; fresh?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (filters.group !== "all") params.set("group", filters.group);
  if (filters.query) params.set("q", filters.query);
  if (!options.fresh) {
    const cursor = options.cursor ?? filters.cursor;
    if (cursor) params.set("cursor", encodeSupportMessageCursor(cursor));
    else if (filters.focus) params.set("focus", filters.focus);
    const until = options.until ?? filters.until;
    if (until) params.set("until", until);
  }
  return `${path}${params.size ? `?${params}` : ""}`;
}
export const supportMessagePageSchema = z
  .object({
    supportCase: z
      .object({
        id: z.string().regex(/^sup_[a-f0-9]{24}$/u),
        subject: z.string().max(120),
        status: z.enum(["open", "resolved", "closed"]),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            id: messageId,
            authorRole: z.enum(["requester", "staff"]),
            body: z.string().max(4000),
            truncated: z.boolean(),
            createdAt: changeHistoryTimeSchema,
          })
          .strict(),
      )
      .max(20),
    until: changeHistoryTimeSchema,
    olderCursor: cursorSchema.nullable(),
    newerCursor: cursorSchema.nullable(),
    focus: messageId.nullable(),
  })
  .strict();
export type SupportMessagePage = z.infer<typeof supportMessagePageSchema>;
