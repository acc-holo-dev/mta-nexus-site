import { LIBRARY_COLLECTION_BATCH_LIMIT, LIBRARY_COLLECTION_ITEM_LIMIT } from "@nexus/domain";
import { z } from "zod";

const requestId = z
  .string()
  .uuid()
  .transform((v) => v.toLowerCase());
const expectedRevision = z.number().int().min(1).max(2_147_483_646);
export const libraryCollectionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/u);
// Reject invisible control characters; names are rendered as text, never HTML.
// biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in private labels.
const safeName = /^[^\u0000-\u001f\u007f]*$/u;
const name = z.string().trim().min(1).max(80).regex(safeName);
const productIds = z
  .array(libraryCollectionIdSchema)
  .min(1)
  .max(LIBRARY_COLLECTION_BATCH_LIMIT)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate references")
  .transform((ids) => [...ids].sort());
export const libraryCollectionCommandSchema = z.discriminatedUnion("action", [
  z.object({ requestId, action: z.literal("create"), name }).strict(),
  z
    .object({
      requestId,
      action: z.literal("duplicate"),
      name,
      sourceCollectionId: libraryCollectionIdSchema,
      expectedRevision: z.number().int().min(1).max(2_147_483_647),
      expectedItemCount: z.number().int().min(0).max(LIBRARY_COLLECTION_ITEM_LIMIT),
      sourceDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    })
    .strict(),
  z.object({ requestId, action: z.literal("rename"), name, expectedRevision }).strict(),
  z.object({ requestId, action: z.literal("archive"), expectedRevision }).strict(),
  z.object({ requestId, action: z.literal("restore"), expectedRevision }).strict(),
  z
    .object({
      requestId,
      action: z.literal("add"),
      productId: libraryCollectionIdSchema,
      expectedRevision,
    })
    .strict(),
  z
    .object({
      requestId,
      action: z.literal("remove"),
      productId: libraryCollectionIdSchema,
      expectedRevision,
    })
    .strict(),
  z
    .object({
      requestId,
      action: z.literal("copy-items"),
      sourceCollectionId: libraryCollectionIdSchema,
      expectedSourceRevision: z.number().int().min(1).max(2_147_483_647),
      productIds,
      expectedRevision,
    })
    .strict(),
  z.object({ requestId, action: z.literal("add-many"), productIds, expectedRevision }).strict(),
  z.object({ requestId, action: z.literal("remove-many"), productIds, expectedRevision }).strict(),
]);
