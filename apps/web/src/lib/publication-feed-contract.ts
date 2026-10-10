import { z } from "zod";
import { parseDiscussionCursor } from "./content-discussion-contract";
export const PUBLICATION_TYPES = [
  "article",
  "devlog",
  "announcement",
  "review",
  "post",
  "question",
  "news",
  "update",
] as const;
export const PUBLICATION_SOURCES = ["user", "organization", "server", "product"] as const;
export function parsePublicationQuery(params: URLSearchParams, following = true) {
  if ([...params.keys()].some((key) => !["q", "type", "source", "cursor"].includes(key)))
    return null;
  const type = params.getAll("type"),
    source = params.getAll("source"),
    query = params.getAll("q");
  if ([type, source, query].some((values) => values.length > 1) || (query[0]?.length ?? 0) > 100)
    return null;
  if (type[0] && !PUBLICATION_TYPES.includes(type[0] as (typeof PUBLICATION_TYPES)[number]))
    return null;
  if (
    source[0] &&
    (!following || !PUBLICATION_SOURCES.includes(source[0] as (typeof PUBLICATION_SOURCES)[number]))
  )
    return null;
  const cursor = parseDiscussionCursor(params);
  if (cursor === null) return null;
  return {
    query: query[0]?.trim() ?? "",
    type: type[0] || undefined,
    source: (source[0] || undefined) as (typeof PUBLICATION_SOURCES)[number] | undefined,
    cursor,
  };
}
export type PublicationQuery = NonNullable<ReturnType<typeof parsePublicationQuery>>;
export function publicationPageQuery(
  params: Record<string, string | string[] | undefined> = {},
  following = true,
): PublicationQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const tolerant = new URLSearchParams();
  const type = first(params.type),
    source = first(params.source);
  if (type && PUBLICATION_TYPES.includes(type as (typeof PUBLICATION_TYPES)[number]))
    tolerant.set("type", type);
  if (
    following &&
    source &&
    PUBLICATION_SOURCES.includes(source as (typeof PUBLICATION_SOURCES)[number])
  )
    tolerant.set("source", source);
  tolerant.set("q", (first(params.q) ?? "").trim().slice(0, 100));
  return parsePublicationQuery(tolerant, following) as PublicationQuery;
}
const context = z.object({
  name: z.string(),
  href: z.string().regex(/^\/(organizations|servers|market)\//u),
});
export const publicationPageSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string(),
          slug: z.string(),
          title: z.string(),
          type: z.enum(PUBLICATION_TYPES),
          excerpt: z.string(),
          image: z.string().nullable(),
          commentCount: z.number().int().nonnegative(),
          publishedAt: z.iso.datetime(),
          author: z.object({
            username: z.string(),
            name: z.string(),
            avatar: z.string().nullable(),
          }),
          organization: context.nullable(),
          server: context.nullable(),
          product: context.nullable(),
        }),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type PublicationPage = z.infer<typeof publicationPageSchema>;
