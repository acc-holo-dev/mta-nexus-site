import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
export const publicApprovalCursorSchema = discussionCursorSchema
  .extend({
    id: z.string().regex(/^[a-f0-9]{32}$/u),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    version: z.literal(1),
  })
  .strict();
export function parseApprovalQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) => !["type", "cursor"].includes(key) || params.getAll(key).length !== 1,
    )
  )
    return null;
  const type = params.get("type") || undefined;
  if (type && !["user", "developer"].includes(type)) return null;
  let cursor: z.infer<typeof publicApprovalCursorSchema> | undefined;
  if (params.has("cursor")) {
    const raw = params.get("cursor") ?? "";
    if (raw.length > 512) return null;
    try {
      const parsed = publicApprovalCursorSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      cursor = parsed.data;
    } catch {
      return null;
    }
  }
  return { type: type as "user" | "developer" | undefined, cursor };
}
export type ApprovalQuery = Partial<NonNullable<ReturnType<typeof parseApprovalQuery>>>;
export const publicApprovalPageSchema = z
  .object({
    subject: z
      .object({
        username: z.string(),
        name: z.string(),
        identityVerified: z.boolean(),
        developerVerified: z.boolean(),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-f0-9]{32}$/u),
            type: z.enum(["user", "developer"]),
            approvedAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type PublicApprovalPage = z.infer<typeof publicApprovalPageSchema>;
export function approvalPageHref(
  username: string,
  filters: ApprovalQuery = {},
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (cursor) params.set("cursor", cursor);
  return `/users/${encodeURIComponent(username)}/trust/history${params.size ? `?${params}` : ""}`;
}
