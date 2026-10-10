import { z } from "zod";
import { createContentSchema, externalWebUrlSchema } from "@nexus/validation";

export const editorialTypes = ["article", "news", "devlog", "update", "announcement"] as const;
export const communityTypes = ["post", "question"] as const;
export const writerTypes = [...editorialTypes, ...communityTypes] as const;
export const contentFieldsSchema = createContentSchema
  .pick({
    title: true,
    body: true,
    excerpt: true,
    tags: true,
    coverImageUrl: true,
  })
  .extend({
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(10).max(20_000),
    tags: z.array(z.string().trim().min(1).max(30)).max(10),
  });
export const writerCreateSchema = contentFieldsSchema
  .extend({
    slug: createContentSchema.shape.slug,
    type: z.enum(writerTypes),
  })
  .strict();
export const writerUpdateSchema = contentFieldsSchema
  .extend({
    expectedUpdatedAt: z.iso.datetime(),
    expectedStatus: z.enum(["draft", "published"]),
  })
  .strict();
export const writerArchiveSchema = z
  .object({ expectedUpdatedAt: z.iso.datetime(), expectedStatus: z.enum(["draft", "published"]) })
  .strict();
export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    bio: z.string().trim().max(2000),
    avatarUrl: externalWebUrlSchema.or(z.literal("")),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();

export type EditableProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  updatedAt: string;
};

export function parseContentPage(
  query: Record<string, string | string[] | undefined> | URLSearchParams,
) {
  const scalar = (key: string) => {
    if (query instanceof URLSearchParams) {
      const values = query.getAll(key);
      return values.length === 1 ? values[0] : "";
    }
    return typeof query[key] === "string" ? (query[key] as string) : "";
  };
  const requested = scalar("page");
  const page = /^[1-9]\d{0,3}$/u.test(requested) ? Number(requested) : 1;
  const status = scalar("status");
  const type = scalar("type");
  return {
    page,
    query: scalar("q").trim().slice(0, 120),
    ...(status === "draft" || status === "published" || status === "archived"
      ? { status: status as "draft" | "published" | "archived" }
      : {}),
    ...(writerTypes.some((value) => value === type)
      ? { type: type as (typeof writerTypes)[number] }
      : {}),
  };
}

export function contentPageHref(
  path: string,
  filters: ReturnType<typeof parseContentPage>,
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  return `${path}${params.size ? `?${params}` : ""}`;
}
