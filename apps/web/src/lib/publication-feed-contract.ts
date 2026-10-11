import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
export const SERVER_PUBLICATION_TYPES = [
  "article",
  "news",
  "devlog",
  "update",
  "announcement",
] as const;
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
const publicationCursorSchema = discussionCursorSchema
  .extend({
    version: z.literal(1),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    direction: z.enum(["older", "newer"]).default("older"),
  })
  .strict();
export function parsePublicationQuery(params: URLSearchParams, following = true, server = false) {
  if (
    [...params.keys()].some(
      (key) =>
        !["q", "type", "source", "cursor", "author", "tag"].includes(key) ||
        params.getAll(key).length !== 1,
    )
  )
    return null;
  const type = params.getAll("type"),
    source = params.getAll("source"),
    query = params.getAll("q");
  const author = params.get("author")?.trim() ?? "",
    tag = params.get("tag")?.trim() ?? "";
  if (
    (query[0]?.length ?? 0) > 100 ||
    (params.get("author")?.length ?? 0) > 128 ||
    (author && !/^[a-zA-Z0-9_-]{1,128}$/u.test(author)) ||
    (params.get("tag")?.length ?? 0) > 30 ||
    [query[0] ?? "", params.get("tag") ?? "", params.get("author") ?? ""].some((value) =>
      Array.from(value).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ),
    )
  )
    return null;
  if (type[0] && !PUBLICATION_TYPES.includes(type[0] as (typeof PUBLICATION_TYPES)[number]))
    return null;
  if (server && type[0] && !(SERVER_PUBLICATION_TYPES as readonly string[]).includes(type[0]))
    return null;
  if (
    source[0] &&
    (!following || !PUBLICATION_SOURCES.includes(source[0] as (typeof PUBLICATION_SOURCES)[number]))
  )
    return null;
  let cursor: z.infer<typeof publicationCursorSchema> | undefined;
  if (params.has("cursor")) {
    const raw = params.get("cursor") ?? "";
    if (raw.length > 512) return null;
    try {
      const parsed = publicationCursorSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      cursor = parsed.data;
    } catch {
      return null;
    }
  }
  return {
    query: query[0]?.trim() ?? "",
    type: type[0] || undefined,
    source: (source[0] || undefined) as (typeof PUBLICATION_SOURCES)[number] | undefined,
    ...(author ? { author } : {}),
    ...(tag ? { tag } : {}),
    cursor,
  };
}
export type PublicationQuery = NonNullable<ReturnType<typeof parsePublicationQuery>>;
/** Page URLs use the same strict filter and continuation contract as the API. */
export function parsePublicationPageQuery(
  params: Record<string, string | string[] | undefined> = {},
  following = true,
  server = false,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined)
      for (const entry of Array.isArray(value) ? value : [value]) query.append(key, entry);
  }
  return parsePublicationQuery(query, following, server);
}
export function publicationHref(path: string, filters: PublicationQuery, cursor?: string | null) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  for (const key of ["type", "source", "author", "tag"] as const)
    if (filters[key]) params.set(key, filters[key]);
  if (cursor) params.set("cursor", cursor);
  return params.size ? `${path}?${params}` : path;
}
export function publicationPageQuery(
  params: Record<string, string | string[] | undefined> = {},
  following = true,
): PublicationQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const clean = (value: string | string[] | undefined, limit: number) =>
    Array.from(first(value) ?? "")
      .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
      .join("")
      .trim()
      .slice(0, limit);
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
  tolerant.set("q", clean(params.q, 100));
  const author = clean(params.author, 128),
    tag = clean(params.tag, 30);
  if (author && /^[a-zA-Z0-9_-]{1,128}$/u.test(author)) tolerant.set("author", author);
  if (tag) tolerant.set("tag", tag);
  return (
    parsePublicationQuery(tolerant, following) ?? {
      query: "",
      type: undefined,
      source: undefined,
      cursor: undefined,
    }
  );
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
          tags: z.array(z.string().max(30)).max(10).default([]),
        }),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
    previousCursor: z.string().max(512).nullable().optional(),
  })
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type PublicationPage = z.infer<typeof publicationPageSchema>;
