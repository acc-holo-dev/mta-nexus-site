import { RESOURCE_RELEASE_WATCH_BATCH_LIMIT } from "@nexus/domain";
import { z } from "zod";
export const resourceReleaseWatchCommandSchema = z
  .object({
    enabled: z.boolean(),
    expectedRevision: z.number().int().min(0).max(2_147_483_646),
  })
  .strict();

export const resourceReleaseWatchDisableCommandSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/u),
            expectedRevision: z.number().int().min(1).max(2_147_483_646),
          })
          .strict(),
      )
      .min(1)
      .max(RESOURCE_RELEASE_WATCH_BATCH_LIMIT)
      .refine((items) => new Set(items.map((item) => item.productId)).size === items.length)
      .transform((items) =>
        items.sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
      ),
  })
  .strict();

export const resourceReleaseWatchEnableCommandSchema = z
  .object({
    expectedCollectionRevision: z.number().int().min(1).max(2_147_483_647),
    items: z
      .array(
        z
          .object({
            productId: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/u),
            expectedRevision: z.number().int().min(0).max(2_147_483_646),
          })
          .strict(),
      )
      .min(1)
      .max(RESOURCE_RELEASE_WATCH_BATCH_LIMIT)
      .refine((items) => new Set(items.map((item) => item.productId)).size === items.length)
      .transform((items) =>
        items.sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
      ),
  })
  .strict();
