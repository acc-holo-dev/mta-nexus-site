import { z } from "zod";
import { RESOURCE_CART_LIMIT, RESOURCE_LIFECYCLE_ACTIONS } from "@nexus/domain";

const resourceId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
export const resourceCartItemSchema = z.object({ productId: resourceId }).strict();
export const resourceCartAcquisitionSchema = z
  .object({
    requestId: z.string().uuid(),
    reviewDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    productIds: z
      .array(resourceId)
      .min(1)
      .max(RESOURCE_CART_LIMIT)
      .refine((ids) => new Set(ids).size === ids.length, "Resource IDs must be unique"),
  })
  .strict();
export const resourceLifecycleSchema = z
  .object({
    action: z.enum(RESOURCE_LIFECYCLE_ACTIONS),
    expectedUpdatedAt: z
      .string()
      .datetime({ precision: 3, offset: false })
      .refine(
        (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
      ),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();
