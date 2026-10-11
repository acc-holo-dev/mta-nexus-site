import { AppError } from "@nexus/domain";
import { z } from "zod";
export const storageDiscoverySchema = z
  .object({
    ownerId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u),
    offset: z.number().int().min(0).max(10000),
  })
  .strict();
export const storageCleanupSchema = z
  .object({
    expectedRevision: z.number().int().positive().max(2147483646),
    confirmation: z.literal("delete_unreferenced"),
  })
  .strict();
export const storageListSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(99999).default(1),
    view: z
      .enum([
        "all",
        "eligible",
        "referenced",
        "observed",
        "retired",
        "deleted",
        "missing",
        "changed",
        "failed",
      ])
      .default("all"),
  })
  .strict();
export function storageQuery(params: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in raw) throw new AppError("Duplicate query", 400, "INVALID_STORAGE_QUERY");
    raw[key] = value;
  }
  return storageParse(storageListSchema, raw);
}
export function storageParse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError("Invalid storage request", 400, "INVALID_STORAGE_QUERY");
  return parsed.data;
}
export function storageOffset(params: URLSearchParams) {
  const parsed = storageParse(
    z.object({ offset: z.coerce.number().int().min(0).max(10000).default(0) }).strict(),
    Object.fromEntries(params),
  );
  if (params.getAll("offset").length > 1)
    throw new AppError("Duplicate query", 400, "INVALID_STORAGE_QUERY");
  return parsed.offset;
}
