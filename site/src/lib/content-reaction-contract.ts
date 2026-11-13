import { z } from "zod";
import { CONTENT_REACTIONS } from "@nexus/domain";
import { discussionCursorSchema } from "./content-discussion-contract";
export const reactionCommandSchema = z
  .object({ reaction: z.enum(CONTENT_REACTIONS).nullable() })
  .strict();
const counts = z
  .object({
    helpful: z.number().int().nonnegative(),
    thanks: z.number().int().nonnegative(),
    insight: z.number().int().nonnegative(),
  })
  .strict();
const reactionStateObject = z
  .object({
    contentId: z.string().min(1).max(128),
    slug: z.string().min(1).max(200),
    authenticated: z.boolean(),
    actorId: z.string().min(1).max(128).nullable(),
    self: z.boolean(),
    reaction: z.enum(CONTENT_REACTIONS).nullable(),
    counts,
  })
  .strict();
export const reactionStateSchema = reactionStateObject.refine(
  (value) => value.authenticated === (value.actorId !== null),
);
export type ReactionState = z.infer<typeof reactionStateSchema>;
const reactionMutationSchema = reactionStateObject
  .omit({ authenticated: true, self: true })
  .extend({ changed: z.boolean() })
  .strict();
export function confirmedReactionMutation(
  value: unknown,
  contentId: string,
  slug: string,
  reaction: (typeof CONTENT_REACTIONS)[number] | null,
  actorId: string,
) {
  const parsed = reactionMutationSchema.safeParse(value);
  return parsed.success &&
    parsed.data.actorId === actorId &&
    parsed.data.contentId === contentId &&
    parsed.data.slug === slug &&
    parsed.data.reaction === reaction
    ? parsed.data
    : null;
}
export function confirmedReactionRemoval(value: unknown, contentId: string, actorId: string) {
  const parsed = z
    .object({ contentId: z.string(), removed: z.literal(true), actorId: z.string() })
    .strict()
    .safeParse(value);
  return parsed.success && parsed.data.contentId === contentId && parsed.data.actorId === actorId;
}
const cursorSchema = discussionCursorSchema
  .extend({ context: z.string().regex(/^[a-f0-9]{64}$/u), version: z.literal(1) })
  .strict();
export function parseReactionPage(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) => !["q", "reaction", "cursor"].includes(key) || params.getAll(key).length !== 1,
    )
  )
    return null;
  const rawQuery = params.get("q") ?? "",
    query = rawQuery.trim(),
    reaction = params.get("reaction") || undefined;
  if (
    rawQuery.length > 100 ||
    Array.from(rawQuery).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    (reaction && !(CONTENT_REACTIONS as readonly string[]).includes(reaction))
  )
    return null;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (params.has("cursor")) {
    const raw = params.get("cursor") ?? "";
    if (raw.length > 512) return null;
    try {
      const parsed = cursorSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      cursor = parsed.data;
    } catch {
      return null;
    }
  }
  return { query, reaction: reaction as (typeof CONTENT_REACTIONS)[number] | undefined, cursor };
}
type ParsedReactionQuery = NonNullable<ReturnType<typeof parseReactionPage>>;
export type ReactionPageQuery = Pick<ParsedReactionQuery, "query"> &
  Partial<Pick<ParsedReactionQuery, "reaction" | "cursor">>;
export const reactionPageSchema = z
  .object({
    items: z
      .array(
        z.object({
          contentId: z.string().min(1).max(128),
          reaction: z.enum(CONTENT_REACTIONS),
          reactedAt: z.iso.datetime(),
          title: z.string().nullable(),
          slug: z.string().nullable(),
          type: z.string().nullable(),
        }),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type ReactionPage = z.infer<typeof reactionPageSchema>;
export function reactionPageHref(filters: ReactionPageQuery, cursor?: string | null) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.reaction) params.set("reaction", filters.reaction);
  if (cursor) params.set("cursor", cursor);
  return `/workspace/reactions${params.size ? `?${params}` : ""}`;
}
