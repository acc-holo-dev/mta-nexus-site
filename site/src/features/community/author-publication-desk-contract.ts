import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
import { writerTypes } from "./user-platform-contract";

const exactTime = discussionCursorSchema.shape.createdAt.refine((value) =>
  /\.\d{6}Z$/u.test(value),
);
const cursor = discussionCursorSchema
  .extend({
    createdAt: exactTime,
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    direction: z.enum(["older", "newer"]),
    version: z.literal(1),
  })
  .strict();
const sourceValues = ["all", "personal", "organization", "server"] as const;
export function parseAuthorPublicationDeskQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) =>
        !["q", "status", "type", "source", "tag", "cursor"].includes(key) ||
        params.getAll(key).length !== 1,
    )
  )
    return null;
  const raw = params.get("q") ?? "",
    tag = params.get("tag") ?? "",
    status = params.get("status") || "all",
    type = params.get("type") || "all",
    source = params.get("source") || "all";
  if (
    raw.length > 100 ||
    tag.length > 30 ||
    [raw, tag].some((value) =>
      Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    ) ||
    !["all", "draft", "published", "archived"].includes(status) ||
    (type !== "all" && !(writerTypes as readonly string[]).includes(type)) ||
    !(sourceValues as readonly string[]).includes(source)
  )
    return null;
  let point: z.infer<typeof cursor> | undefined;
  if (params.has("cursor")) {
    const rawCursor = params.get("cursor") ?? "";
    if (rawCursor.length > 512) return null;
    try {
      const parsed = cursor.safeParse(JSON.parse(rawCursor));
      if (!parsed.success) return null;
      point = parsed.data;
    } catch {
      return null;
    }
  }
  return {
    query: raw.trim(),
    tag: tag.trim(),
    status: status as "all" | "draft" | "published" | "archived",
    type: type as "all" | (typeof writerTypes)[number],
    source: source as (typeof sourceValues)[number],
    cursor: point,
  };
}
export type AuthorPublicationDeskQuery = NonNullable<
  ReturnType<typeof parseAuthorPublicationDeskQuery>
>;
export function authorPublicationDeskHref(
  filters: AuthorPublicationDeskQuery,
  point?: string | null,
) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.tag) params.set("tag", filters.tag);
  for (const key of ["status", "type", "source"] as const)
    if (filters[key] !== "all") params.set(key, filters[key]);
  if (point) params.set("cursor", point);
  return `/workspace/content${params.size ? `?${params}` : ""}`;
}
export function parseAuthorPublicationHistoryQuery(params: URLSearchParams) {
  if ([...params.keys()].some((key) => key !== "cursor" || params.getAll(key).length !== 1))
    return null;
  if (!params.has("cursor")) return { cursor: undefined };
  const raw = params.get("cursor") ?? "";
  if (raw.length > 512) return null;
  try {
    const parsed = cursor.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.direction === "older" ? { cursor: parsed.data } : null;
  } catch {
    return null;
  }
}
export const authorPublicationRestoreSchema = z.object({ expectedRevision: exactTime }).strict();
export function confirmedAuthorPublicationRestore(value: unknown, id: string, previous: string) {
  const result = z
    .object({ id: z.string(), status: z.literal("draft"), revision: exactTime })
    .strict()
    .safeParse(value);
  return result.success && result.data.id === id && result.data.revision > previous;
}
