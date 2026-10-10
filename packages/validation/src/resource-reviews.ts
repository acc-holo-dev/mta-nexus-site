import { z } from "zod";
const revision = z.number().int().min(0).max(2147483646);
export const resourceReviewCreateSchema = z
  .object({
    text: z.string().trim().min(3).max(4000),
    rating: z.number().int().min(1).max(5),
  })
  .strict();
export const resourceReviewCommandSchema = z.discriminatedUnion("action", [
  resourceReviewCreateSchema
    .extend({ action: z.literal("save"), expectedRevision: revision })
    .strict(),
  z.object({ action: z.literal("withdraw"), expectedRevision: revision.min(1) }).strict(),
]);
export const resourceReviewReportSchema = z
  .object({
    type: z.enum(["spam", "abuse", "copyright", "other"]),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export const resourceReviewDecisionSchema = z
  .object({
    action: z.enum(["review", "resolve", "dismiss", "remove_review"]),
    expectedStatus: z.enum(["open", "under_review"]),
    notes: z.string().trim().min(3).max(2000),
    expectedRevision: revision.min(1).optional(),
  })
  .strict()
  .refine((value) =>
    value.action === "remove_review"
      ? value.expectedRevision !== undefined
      : value.expectedRevision === undefined,
  );
