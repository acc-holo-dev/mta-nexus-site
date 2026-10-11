import { z } from "zod";
import { parseModerationQuery } from "./community-moderation-contract";
import { PUBLICATION_TYPES } from "./publication-feed-contract";
export function parseModeratedDiscussionQuery(params: URLSearchParams) {
  if ([...params.keys()].some((key) => !["q", "author", "cursor"].includes(key))) return null;
  const copy = new URLSearchParams(params);
  copy.set("status", "all");
  const parsed = parseModerationQuery(copy);
  return parsed ? { query: parsed.query, author: parsed.author, cursor: parsed.cursor } : null;
}
export type ModeratedDiscussionQuery = NonNullable<
  ReturnType<typeof parseModeratedDiscussionQuery>
>;
const publication = z
  .object({
    id: z.string().min(1).max(128),
    title: z.string(),
    slug: z.string(),
    type: z.enum(PUBLICATION_TYPES),
    status: z.enum(["draft", "published", "archived"]),
  })
  .strict();
const text = (limit: number) =>
  z
    .string()
    .max(limit * 2)
    .refine((value) => Array.from(value).length <= limit);
const author = z.object({ username: z.string(), name: z.string() }).strict().nullable();
const continuation = { hasMore: z.boolean(), nextCursor: z.string().max(512).nullable() };
export const moderatedDiscussionPageSchema = z
  .object({
    publication,
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(128),
            text: text(350),
            createdAt: z.iso.datetime(),
            author,
          })
          .strict(),
      )
      .max(20),
    ...continuation,
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export const moderatedDiscussionDetailSchema = z
  .object({
    publication,
    comment: z
      .object({
        id: z.string().min(1).max(128),
        text: text(5000),
        truncated: z.boolean(),
        revision: z.string().regex(/^[a-f0-9]{64}$/u),
        createdAt: z.iso.datetime(),
        author,
        parent: text(350).nullable(),
      })
      .strict()
      .nullable(),
    history: z
      .array(
        z
          .object({
            id: z.string(),
            action: z.enum(["content.comment_edited", "content.comment_removed"]),
            moderator: z.boolean(),
            reason: text(1000).nullable(),
            createdAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(20),
    ...continuation,
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export const moderatedDiscussionRemoveSchema = z
  .object({
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export function moderatedDiscussionHref(
  id: string,
  filters?: Pick<ModeratedDiscussionQuery, "query" | "author">,
  cursor?: string | null,
  commentId?: string,
) {
  const params = new URLSearchParams();
  if (filters?.query) params.set("q", filters.query);
  if (filters?.author) params.set("author", filters.author);
  if (cursor) params.set("cursor", cursor);
  return `/admin/community/${encodeURIComponent(id)}/discussion${commentId ? `/${encodeURIComponent(commentId)}` : ""}${params.size ? `?${params}` : ""}`;
}
export function confirmsModeratedDiscussionRemoval(
  value: unknown,
  contentId: string,
  commentId: string,
) {
  return z
    .object({
      contentId: z.literal(contentId),
      commentId: z.literal(commentId),
      removed: z.literal(true),
    })
    .strict()
    .safeParse(value).success;
}
