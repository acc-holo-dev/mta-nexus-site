import { fieldClassBlock } from "@nexus/ui";
import { z } from "zod";
import type { Locale } from "./i18n";
import { privateApiRequest } from "./private-api-request";
import { contentFieldsSchema, profileUpdateSchema } from "./user-platform-contract";
import { userPlatformError } from "./user-platform-copy";

/** Alias kept for existing platform screens; new code should import from `@nexus/ui`. */
export const platformFieldClass = fieldClassBlock;

const editableContentSchema = contentFieldsSchema
  .extend({
    // Legacy drafts may exceed today's write limits; let authors open and shorten them.
    body: z.string(),
    tags: z.array(z.string()),
    excerpt: contentFieldsSchema.shape.excerpt.nullable().transform((value) => value ?? ""),
    coverImageUrl: contentFieldsSchema.shape.coverImageUrl
      .nullable()
      .transform((value) => value ?? ""),
    id: z.string().min(1).max(128),
    slug: z.string().regex(/^[a-z0-9-]+$/u),
    type: z.string(),
    status: z.enum(["draft", "published", "archived"]),
    updatedAt: z.iso.datetime(),
  })
  .passthrough();
const editableProfileSchema = profileUpdateSchema.omit({ expectedUpdatedAt: true }).extend({
  id: z.string().min(1),
  username: z.string().min(1),
  updatedAt: z.iso.datetime(),
});
export type EditableContent = z.infer<typeof editableContentSchema>;
export function parseEditableContent(value: unknown) {
  const parsed = editableContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function parseEditableProfile(value: unknown) {
  const parsed = editableProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function platformRequest(
  path: string,
  locale: Locale,
  method = "GET",
  json?: unknown,
  signal?: AbortSignal,
  translateError: (locale: Locale, code: unknown) => string = userPlatformError,
) {
  const response = await fetch(
    path,
    privateApiRequest({ method, json, signal, timeoutMs: 15_000 }),
  ).catch(() => {
    throw new Error(translateError(locale, "INTERNAL_ERROR"));
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data && typeof data === "object" && "code" in data ? data.code : null;
    throw new Error(translateError(locale, code));
  }
  if (!data || typeof data !== "object") throw new Error(translateError(locale, "UNCONFIRMED"));
  return data as Record<string, unknown>;
}
