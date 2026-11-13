import {
  COMMERCIAL_CURRENCIES,
  BASE_COMMISSION_BPS,
  type CommercialPlanTerms,
} from "@nexus/domain";
import { z } from "zod";

const reason = z.string().trim().min(5).max(1000);
const expectedRevision = z.number().int().min(1).max(2_147_483_646);
export const commercialPlanTermsSchema = z
  .object({
    titleRu: z.string().trim().min(3).max(100),
    titleEn: z.string().trim().min(3).max(100),
    descriptionRu: z.string().trim().min(10).max(2000),
    descriptionEn: z.string().trim().min(10).max(2000),
    price: z.number().int().min(0).max(100_000_000),
    currency: z.enum(COMMERCIAL_CURRENCIES),
    durationDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]),
    commissionBps: z.number().int().min(0).max(BASE_COMMISSION_BPS),
  })
  .strict() satisfies z.ZodType<CommercialPlanTerms>;
export const commercialPlanCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      slug: z
        .string()
        .min(3)
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
      scope: z.enum(["user", "organization"]),
      terms: commercialPlanTermsSchema,
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      expectedRevision,
      terms: commercialPlanTermsSchema,
      reason,
    })
    .strict(),
  z.object({ action: z.literal("publish"), expectedRevision, reason }).strict(),
  z.object({ action: z.literal("archive"), expectedRevision, reason }).strict(),
  z.object({ action: z.literal("restore"), expectedRevision, reason }).strict(),
]);
export const orderCancellationCommandSchema = z
  .object({
    requestId: z.string().uuid(),
    expectedUpdatedAt: z
      .string()
      .datetime({ precision: 3, offset: false })
      .refine(
        (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
      ),
    reason,
  })
  .strict();
