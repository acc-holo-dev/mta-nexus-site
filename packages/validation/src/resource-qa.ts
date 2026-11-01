import { z } from "zod";

const revision = z.number().int().min(0).max(2147483646);
const body = z.string().trim().min(3).max(4000);
const buildId = z.string().trim().min(1).max(128).nullable().optional();

export const resourceQaAskSchema = z
  .object({
    body,
    buildId,
  })
  .strict();

export const resourceQaAnswerSchema = z
  .object({
    body,
    expectedThreadRevision: revision.min(1),
  })
  .strict();

export const resourceQaResolveSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("resolve"),
      answerId: z.string().trim().min(1).max(128),
      expectedRevision: revision.min(1),
    })
    .strict(),
  z
    .object({
      action: z.literal("reopen"),
      expectedRevision: revision.min(1),
    })
    .strict(),
]);

export const resourceQaFollowSchema = z
  .object({
    action: z.enum(["follow", "unfollow"]),
    expectedRevision: revision,
  })
  .strict();
