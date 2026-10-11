import { z } from "zod";
import { parseModerationDetailQuery } from "./community-moderation-contract";
import { REPORT_TYPES } from "./community-report-contract";
import { moderatedDiscussionPageSchema } from "./moderated-discussion-contract";
export function parseDiscussionReportsQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) => !["q", "view", "type", "cursor"].includes(key) || params.getAll(key).length !== 1,
    )
  )
    return null;
  const raw = params.get("q") ?? "",
    view = params.get("view") ?? "pending",
    type = params.get("type") || undefined;
  if (
    raw.length > 100 ||
    Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !["pending", "history"].includes(view) ||
    (type && !(REPORT_TYPES as readonly string[]).includes(type))
  )
    return null;
  const point = parseModerationDetailQuery(
    new URLSearchParams(params.has("cursor") ? { cursor: params.get("cursor") ?? "" } : {}),
  );
  if (!point || (point.cursor && !/\.\d{6}Z$/u.test(point.cursor.createdAt))) return null;
  return { query: raw.trim(), view: view as "pending" | "history", type, cursor: point.cursor };
}
export type DiscussionReportsQuery = NonNullable<ReturnType<typeof parseDiscussionReportsQuery>>;
export const discussionReportsPageSchema = z
  .object({
    publication: moderatedDiscussionPageSchema.shape.publication,
    commentId: z.string().min(1).max(128),
    removed: z.boolean(),
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
            type: z.enum(REPORT_TYPES),
            reason: z
              .string()
              .max(2000)
              .refine((value) => Array.from(value).length <= 1000),
            status: z.enum(["open", "under_review", "resolved", "dismissed"]),
            createdAt: z.iso.datetime(),
            resolvedAt: z.iso.datetime().nullable(),
          })
          .strict(),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export function discussionReportsHref(
  id: string,
  commentId: string,
  filters?: Pick<DiscussionReportsQuery, "query" | "view" | "type">,
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  if (filters?.query) params.set("q", filters.query);
  if (filters?.view === "history") params.set("view", "history");
  if (filters?.type) params.set("type", filters.type);
  if (cursor) params.set("cursor", cursor);
  return `/admin/community/${encodeURIComponent(id)}/discussion/${encodeURIComponent(commentId)}/reports${params.size ? `?${params}` : ""}`;
}
