import { z } from "zod";
import { parseDiscussionCursor } from "./content-discussion-contract";
export const FOLLOW_TYPES = ["server", "user", "organization", "product", "content"] as const;
const OBJECT_MUTE_DURATIONS = ["24h", "7d", "30d"] as const;
export const followCommandSchema = z
  .object({
    expectedActorId: z.string().min(1).max(128).optional(),
    targetType: z.enum(FOLLOW_TYPES),
    targetId: z.string().trim().min(1).max(128),
    notifyComments: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.targetType !== "content" || /^[A-Za-z0-9_-]{1,128}$/u.test(value.targetId),
  )
  .refine((value) => value.notifyComments === undefined || value.targetType === "content", {
    message: "notifyComments applies only to content follows",
  });
export const objectMuteCommandSchema = z
  .object({
    expectedActorId: z.string().min(1).max(128).optional(),
    targetType: z.enum(FOLLOW_TYPES),
    targetId: z.string().trim().min(1).max(128),
    duration: z.enum(OBJECT_MUTE_DURATIONS).nullable(),
  })
  .strict()
  .refine((value) => /^[A-Za-z0-9_-]{1,128}$/u.test(value.targetId));
export type FollowTargetType = (typeof FOLLOW_TYPES)[number];
export type ObjectMuteDuration = (typeof OBJECT_MUTE_DURATIONS)[number];
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
  notifyComments: z.boolean(),
  createdAt: z.iso.datetime(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  verified: z.boolean(),
  discussion: z
    .object({
      replyCount: z.number().int().min(0),
      latestId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,128}$/u)
        .nullable(),
      latestAt: z.iso.datetime().nullable(),
    })
    .strict()
    .refine((value) => (value.latestId === null) === (value.latestAt === null))
    .nullable()
    .optional(),
  href: z
    .string()
    .regex(/^\/(users|organizations|servers|market|articles)\//u)
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
