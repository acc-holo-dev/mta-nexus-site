import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
const cursorSchema = discussionCursorSchema
  .extend({ context: z.string().regex(/^[a-f0-9]{64}$/u), version: z.literal(1) })
  .strict();
export function parseOwnDiscussionQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) => !["q", "availability", "cursor"].includes(key) || params.getAll(key).length !== 1,
    )
  )
    return null;
  const raw = params.get("q") ?? "",
    availability = params.get("availability") || undefined;
  if (
    raw.length > 120 ||
    Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    (availability !== undefined && !["available", "unavailable"].includes(availability))
  )
    return null;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (params.has("cursor")) {
    const value = params.get("cursor") ?? "";
    if (value.length > 512) return null;
    try {
      const parsed = cursorSchema.safeParse(JSON.parse(value));
      if (!parsed.success) return null;
      cursor = parsed.data;
    } catch {
      return null;
    }
  }
  return {
    query: raw.trim(),
    availability: availability as "available" | "unavailable" | undefined,
    cursor,
  };
}
type ParsedQuery = NonNullable<ReturnType<typeof parseOwnDiscussionQuery>>;
export type OwnDiscussionQuery = Pick<ParsedQuery, "query"> &
  Partial<Pick<ParsedQuery, "availability" | "cursor">>;
const summary = z
  .object({
    id: z.string().min(1).max(128),
    text: z.string().max(350),
    createdAt: z.iso.datetime(),
    slug: z.string().nullable(),
    title: z.string().nullable(),
    type: z.string().nullable(),
    available: z.boolean(),
  })
  .strict();
export const ownDiscussionPageSchema = z
  .object({
    items: z.array(summary).max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export const ownDiscussionSchema = summary
  .extend({
    text: z.string().max(5000),
    contentId: z.string().min(1).max(128),
    revision: z.string().regex(/^[a-f0-9]{64}$/u),
    editable: z.boolean(),
  })
  .strict();
export type OwnDiscussionPage = z.infer<typeof ownDiscussionPageSchema>;
export type OwnDiscussion = z.infer<typeof ownDiscussionSchema>;
export function ownDiscussionHref(filters: OwnDiscussionQuery, cursor?: string | null) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.availability) params.set("availability", filters.availability);
  if (cursor) params.set("cursor", cursor);
  return `/workspace/discussions${params.size ? `?${params}` : ""}`;
}
