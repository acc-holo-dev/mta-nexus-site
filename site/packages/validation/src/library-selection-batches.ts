import { LIBRARY_SELECTION_BATCH_LIMIT } from "@nexus/domain";
import { z } from "zod";
import { libraryCollectionIdSchema } from "./library-collections";
const choiceFields = {
  mode: z.enum(["fixed", "latest"]),
  productIds: z
    .array(libraryCollectionIdSchema)
    .min(1)
    .max(LIBRARY_SELECTION_BATCH_LIMIT)
    .refine((ids) => new Set(ids).size === ids.length)
    .transform((ids) => [...ids].sort()),
};
export const librarySelectionBatchChoiceSchema = z.object(choiceFields).strict();
export const librarySelectionBatchCommandSchema = z
  .object({
    ...choiceFields,
    requestId: z
      .string()
      .uuid()
      .transform((v) => v.toLowerCase()),
    previewDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
export const librarySelectionBatchStateSchema = z
  .object({
    revision: z.number().int().min(0).max(2147483647),
    mode: z.enum(["fixed", "latest"]),
    buildId: libraryCollectionIdSchema.nullable(),
  })
  .strict()
  .refine((v) => (v.mode === "latest" ? v.buildId === null : v.buildId !== null && v.revision > 0));
export const librarySelectionBatchSnapshotSchema = z
  .object({
    collectionId: libraryCollectionIdSchema,
    collectionRevision: z.number().int().positive(),
    mode: z.enum(["fixed", "latest"]),
    items: z
      .array(
        z
          .object({
            productId: libraryCollectionIdSchema,
            previous: librarySelectionBatchStateSchema,
            next: librarySelectionBatchStateSchema,
          })
          .strict(),
      )
      .min(1)
      .max(LIBRARY_SELECTION_BATCH_LIMIT),
  })
  .strict();
