import { z } from "zod";
import { publicApprovalCursorSchema } from "./public-verification-history-contract";
export type ContextKind = "organization" | "server";
export const parseContextKind = (value: string): ContextKind | null =>
  value === "organizations" ? "organization" : value === "servers" ? "server" : null;
export function parseContextTrustQuery(params: URLSearchParams) {
  if ([...params.keys()].some((key) => key !== "cursor" || params.getAll(key).length !== 1))
    return null;
  if (!params.has("cursor")) return {};
  const value = params.get("cursor") ?? "";
  if (value.length > 512) return null;
  try {
    const result = publicApprovalCursorSchema.safeParse(JSON.parse(value));
    return result.success ? { cursor: result.data } : null;
  } catch {
    return null;
  }
}
export type ContextTrustQuery = NonNullable<ReturnType<typeof parseContextTrustQuery>>;
export const publicContextTrustSchema = z
  .object({
    subject: z
      .object({
        kind: z.enum(["organization", "server"]),
        slug: z.string(),
        name: z.string(),
        createdAt: z.iso.datetime(),
        verified: z.boolean(),
        publications: z.number().int().nonnegative(),
        servers: z
          .object({
            total: z.number().int().nonnegative(),
            verified: z.number().int().nonnegative(),
          })
          .strict()
          .refine((value) => value.verified <= value.total)
          .nullable(),
        organization: z
          .object({ slug: z.string(), name: z.string(), verified: z.boolean() })
          .strict()
          .nullable(),
        ownershipKind: z.enum(["organization", "personal", "unclaimed"]).nullable(),
      })
      .strict(),
    items: z
      .array(
        z
          .object({ key: z.string().regex(/^[a-f0-9]{32}$/u), approvedAt: z.iso.datetime() })
          .strict(),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type PublicContextTrust = z.infer<typeof publicContextTrustSchema>;
export function contextTrustHref(kind: ContextKind, slug: string, cursor?: string | null) {
  const path = `/${kind === "organization" ? "organizations" : "servers"}/${encodeURIComponent(slug)}/trust`;
  return cursor ? `${path}?${new URLSearchParams({ cursor })}` : path;
}
