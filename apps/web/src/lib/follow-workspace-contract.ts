import { z } from "zod";
import { parseDiscussionCursor } from "./content-discussion-contract";
export const FOLLOW_TYPES = ["server", "user", "organization", "product"] as const;
export const followCommandSchema = z
  .object({ targetType: z.enum(FOLLOW_TYPES), targetId: z.string().trim().min(1).max(128) })
  .strict();
export type FollowTargetType = (typeof FOLLOW_TYPES)[number];
export function parseFollowQuery(params: URLSearchParams) {
  const types = params.getAll("type");
  const queries = params.getAll("q");
  if (types.length > 1 || queries.length > 1 || (queries[0]?.length ?? 0) > 100) return null;
  const type = types[0];
  if (type && !FOLLOW_TYPES.includes(type as FollowTargetType)) return null;
  const cursor = parseDiscussionCursor(params);
  if (cursor === null) return null;
  return {
    type: type ? (type as FollowTargetType) : undefined,
    query: queries[0]?.trim() ?? "",
    cursor,
  };
}
const item = z.object({
  id: z.string().min(1).max(128),
  targetType: z.enum(FOLLOW_TYPES),
  targetId: z.string().min(1).max(128),
  createdAt: z.iso.datetime(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  verified: z.boolean(),
  href: z
    .string()
    .regex(/^\/(users|organizations|servers|market)\//u)
    .nullable(),
});
export const followPageSchema = z
  .object({
    items: z.array(item).max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type FollowPage = z.infer<typeof followPageSchema>;
