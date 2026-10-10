import { SUPPORT_CASE_CATEGORIES, SUPPORT_CASE_STATUSES } from "@nexus/domain";
import { z } from "zod";
const supportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(9999).default(1),
    q: z.string().trim().max(120).default(""),
    status: z.enum(SUPPORT_CASE_STATUSES).optional(),
    category: z.enum(SUPPORT_CASE_CATEGORIES).optional(),
  })
  .strict();
export type SupportQuery = z.infer<typeof supportQuerySchema>;
export function supportQuery(params: URLSearchParams, api = false) {
  const fields: Record<string, string> = {};
  for (const [key, value] of params) {
    if (api && key === "scope" && value === "staff" && params.getAll(key).length === 1) continue;
    if (!["page", "q", "status", "category"].includes(key) || params.getAll(key).length !== 1)
      return null;
    if ((key === "status" || key === "category") && value === "") continue;
    fields[key] = value;
  }
  const parsed = supportQuerySchema.safeParse(fields);
  return parsed.success ? parsed.data : null;
}
export function supportHref(base: string, filters: SupportQuery, page = filters.page) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  return `${base}${params.size ? `?${params}` : ""}`;
}
export const supportActivitySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
            from: z.enum(SUPPORT_CASE_STATUSES),
            to: z.enum(SUPPORT_CASE_STATUSES),
            by: z.enum(["staff", "requester"]),
            createdAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/u)
      .nullable(),
  })
  .strict();
