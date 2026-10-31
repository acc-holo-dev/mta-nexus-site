import { z } from "zod";

const revision = z.number().int().min(0).max(2147483646);

export const serverReviewCreateSchema = z
  .object({
    text: z.string().trim().min(3).max(4000),
    rating: z.number().int().min(1).max(5),
  })
  .strict();

export const serverReviewCommandSchema = z.discriminatedUnion("action", [
  serverReviewCreateSchema
    .extend({ action: z.literal("save"), expectedRevision: revision })
    .strict(),
  z.object({ action: z.literal("withdraw"), expectedRevision: revision.min(1) }).strict(),
]);

export const serverReviewModerationSchema = z
  .object({
    action: z.literal("remove"),
    expectedRevision: revision.min(1),
    notes: z.string().trim().min(3).max(2000),
  })
  .strict();
