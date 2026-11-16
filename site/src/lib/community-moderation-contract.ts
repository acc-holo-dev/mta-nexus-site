import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
import { PUBLICATION_TYPES } from "./publication-feed-contract";
const cursorSchema = discussionCursorSchema
  .extend({ context: z.string().regex(/^[a-f0-9]{64}$/u), version: z.literal(1) })
  .strict();
function cursor(params: URLSearchParams) {
  if (!params.has("cursor")) return undefined;
  const raw = params.get("cursor") ?? "";
  if (raw.length > 512) return null;
  try {
    const value = cursorSchema.safeParse(JSON.parse(raw));
    return value.success ? value.data : null;
  } catch {
    return null;
  }
}
export function parseModerationQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) =>
        !["q", "status", "type", "author", "cursor"].includes(key) ||
        params.getAll(key).length !== 1,
    )
  )
    return null;
  const query = (params.get("q") ?? "").trim(),
    raw = params.get("q") ?? "",
    status = params.get("status") ?? "draft",
    type = params.get("type") || undefined,
    author = params.get("author")?.trim() || undefined;
  if (
    raw.length > 100 ||
    Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !["draft", "published", "archived", "all"].includes(status) ||
    (type && !(PUBLICATION_TYPES as readonly string[]).includes(type)) ||
    (author &&
      (!/^[a-zA-Z0-9_-]{1,128}$/u.test(author) || (params.get("author")?.length ?? 0) > 128))
  )
    return null;
  const point = cursor(params);
  if (point === null) return null;
  return {
    query,
    status: status === "all" ? undefined : (status as "draft" | "published" | "archived"),
    type,
    author,
    cursor: point,
  };
}
export function parseModerationDetailQuery(params: URLSearchParams) {
  if ([...params.keys()].some((key) => key !== "cursor" || params.getAll(key).length !== 1))
    return null;
  const point = cursor(params);
  return point === null ? null : { cursor: point };
}
type ParsedModerationQuery = NonNullable<ReturnType<typeof parseModerationQuery>>;
export type ModerationQuery = Pick<ParsedModerationQuery, "query"> &
  Partial<Omit<ParsedModerationQuery, "query">>;
export const moderationCommandSchema = z
  .object({
    action: z.enum(["publish", "archive"]),
    notes: z.string().trim().min(3).max(2000),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();
const statusSchema = z.enum(["draft", "published", "archived"]);
// PostgreSQL left/length count Unicode characters, rather than UTF-16 units.
const boundedText = (characters: number) =>
  z
    .string()
    .max(characters * 2)
    .refine((value) => Array.from(value).length <= characters);
const itemSchema = z
  .object({
    id: z.string().min(1).max(128),
    slug: z.string(),
    title: z.string(),
    type: z.enum(PUBLICATION_TYPES),
    status: statusSchema,
    excerpt: boundedText(350),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    author: z.object({ username: z.string(), name: z.string(), avatar: z.string().nullable() }),
  })
  .strict();
export const moderationPageSchema = z
  .object({
    items: z.array(itemSchema).max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
const affiliation = z
  .object({ name: z.string(), href: z.string().regex(/^\/(organizations|servers)\//u) })
  .nullable();
export const moderationDetailSchema = z
  .object({
    item: itemSchema
      .extend({
        body: boundedText(100000),
        truncated: z.boolean(),
        tags: z.array(boundedText(30)).max(10),
        organization: affiliation,
        server: affiliation,
      })
      .strict(),
    history: z
      .array(
        z
          .object({
            id: z.string(),
            action: z.enum(["content.published", "content.archived"]),
            createdAt: z.iso.datetime(),
            from: statusSchema.nullable(),
            to: statusSchema.nullable(),
            notes: boundedText(2000).nullable(),
          })
          .strict(),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export function moderationHref(
  filters: Pick<ModerationQuery, "query" | "status" | "type" | "author">,
  point?: string | null,
) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "draft") params.set("status", filters.status ?? "all");
  if (filters.type) params.set("type", filters.type);
  if (filters.author) params.set("author", filters.author);
  if (point) params.set("cursor", point);
  return `/admin/community${params.size ? `?${params}` : ""}`;
}
export function moderationDetailHref(id: string, point?: string | null) {
  return `/admin/community/${encodeURIComponent(id)}${point ? `?${new URLSearchParams({ cursor: point })}` : ""}`;
}
export function confirmsModerationCommand(
  value: unknown,
  id: string,
  action: "publish" | "archive",
  previous: string,
) {
  const parsed = z
    .object({
      id: z.literal(id),
      action: z.literal(action),
      status: z.literal(action === "publish" ? "published" : "archived"),
      updatedAt: z.iso.datetime(),
    })
    .strict()
    .safeParse(value);
  return parsed.success && Date.parse(parsed.data.updatedAt) > Date.parse(previous)
    ? parsed.data
    : null;
}
