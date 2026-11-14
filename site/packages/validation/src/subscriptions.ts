import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/u)
  .refine((v) => v.trim() === v);
const base = { requestId: z.string().uuid(), organizationId: id.optional() };
export const subscriptionCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...base,
      action: z.literal("activate"),
      planId: id,
      expectedRevision: z.number().int().min(1).max(2_147_483_646),
    })
    .strict(),
  z.object({ ...base, action: z.literal("cancel"), subscriptionId: id }).strict(),
]);
