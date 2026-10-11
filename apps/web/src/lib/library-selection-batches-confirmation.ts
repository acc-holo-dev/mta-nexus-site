import type {
  LibrarySelectionBatchChoice,
  LibrarySelectionBatchCommand,
  LibrarySelectionBatchPreview,
} from "@nexus/domain";
import { nextLibrarySelection } from "@nexus/domain";
import {
  libraryCollectionIdSchema,
  librarySelectionBatchChoiceSchema,
  librarySelectionBatchCommandSchema,
  librarySelectionBatchSnapshotSchema,
  librarySelectionBatchStateSchema,
} from "@nexus/validation";
import { z } from "zod";
const previewSchema = z
  .object({
    collection: z
      .object({
        id: libraryCollectionIdSchema,
        name: z.string().min(1).max(80),
        status: z.literal("active"),
        revision: z.number().int().positive(),
      })
      .strict(),
    choice: librarySelectionBatchChoiceSchema,
    previewDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    changedCount: z.number().int().min(0).max(20),
    items: z
      .array(
        z
          .object({
            productId: libraryCollectionIdSchema,
            previous: librarySelectionBatchStateSchema,
            next: librarySelectionBatchStateSchema,
            title: z.string().min(1).max(200),
            version: z.string().min(1).max(128),
            targetBuildId: libraryCollectionIdSchema,
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export function confirmedSelectionBatchPreview(
  value: unknown,
  id: string,
  choice: LibrarySelectionBatchChoice,
): LibrarySelectionBatchPreview | null {
  const parsed = previewSchema.safeParse(value),
    expected = librarySelectionBatchChoiceSchema.safeParse(choice);
  if (!parsed.success || !expected.success) return null;
  const p = parsed.data;
  if (
    p.collection.id !== id ||
    JSON.stringify(p.choice) !== JSON.stringify(expected.data) ||
    JSON.stringify(p.items.map((i) => i.productId)) !== JSON.stringify(expected.data.productIds) ||
    p.changedCount !== p.items.filter((i) => i.previous.revision !== i.next.revision).length ||
    p.items.some(
      (i) =>
        JSON.stringify(i.next) !==
        JSON.stringify(nextLibrarySelection(i.previous, p.choice.mode, i.targetBuildId)),
    )
  )
    return null;
  return p;
}
const resultSchema = z
  .object({
    replayed: z.boolean(),
    receipt: z
      .object({
        id: libraryCollectionIdSchema,
        requestId: z.string().uuid(),
        command: librarySelectionBatchCommandSchema,
        snapshot: librarySelectionBatchSnapshotSchema,
        createdAt: z.string().datetime(),
      })
      .strict(),
  })
  .strict();
export function confirmedSelectionBatchResult(
  value: unknown,
  command: LibrarySelectionBatchCommand,
  preview: LibrarySelectionBatchPreview,
): boolean {
  const parsed = resultSchema.safeParse(value),
    expected = librarySelectionBatchCommandSchema.safeParse(command);
  if (!parsed.success || !expected.success) return false;
  const r = parsed.data.receipt;
  return (
    r.requestId === expected.data.requestId &&
    JSON.stringify(r.command) === JSON.stringify(expected.data) &&
    r.snapshot.collectionId === preview.collection.id &&
    r.snapshot.collectionRevision === preview.collection.revision &&
    r.snapshot.mode === preview.choice.mode &&
    JSON.stringify(r.snapshot.items) ===
      JSON.stringify(
        preview.items.map(({ productId, previous, next }) => ({ productId, previous, next })),
      )
  );
}
