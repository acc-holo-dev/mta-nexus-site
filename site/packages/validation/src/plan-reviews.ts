import type { PlanReviewCommand } from "@nexus/domain";
import { z } from "zod";

const id = z
  .string()
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/u)
  .refine((v) => v.trim() === v);
export const planReviewCommandSchema = z
  .object({
    requestId: z.string().uuid(),
    planId: id,
    expectedRevision: z.number().int().min(1).max(2_147_483_646),
    organizationId: id.optional(),
    grossAmount: z.number().int().min(0).max(100_000_000),
    currency: z.enum(["USD", "EUR", "RUB"]),
  })
  .strict() satisfies z.ZodType<PlanReviewCommand>;
