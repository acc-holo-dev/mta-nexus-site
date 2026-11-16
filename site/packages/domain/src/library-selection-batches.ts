import type { LibraryCollectionSnapshot } from "./library-collections";
export const LIBRARY_SELECTION_BATCH_LIMIT = 20;
export type LibrarySelectionBatchChoice = { mode: "fixed" | "latest"; productIds: string[] };
export type LibrarySelectionBatchCommand = LibrarySelectionBatchChoice & {
  requestId: string;
  previewDigest: string;
};
export type LibrarySelectionBatchState = {
  revision: number;
  mode: "fixed" | "latest";
  buildId: string | null;
};
export type LibrarySelectionBatchItem = {
  productId: string;
  previous: LibrarySelectionBatchState;
  next: LibrarySelectionBatchState;
};
export type LibrarySelectionBatchSnapshot = {
  collectionId: string;
  collectionRevision: number;
  mode: "fixed" | "latest";
  items: LibrarySelectionBatchItem[];
};
export type LibrarySelectionBatchPreview = {
  collection: LibraryCollectionSnapshot;
  choice: LibrarySelectionBatchChoice;
  previewDigest: string;
  changedCount: number;
  items: (LibrarySelectionBatchItem & { title: string; version: string; targetBuildId: string })[];
};
export type LibrarySelectionBatchReceipt = {
  id: string;
  requestId: string;
  command: LibrarySelectionBatchCommand;
  snapshot: LibrarySelectionBatchSnapshot;
  createdAt: Date;
};
export type LibrarySelectionBatchResult = {
  receipt: LibrarySelectionBatchReceipt;
  replayed: boolean;
};
export function nextLibrarySelection(
  previous: LibrarySelectionBatchState,
  mode: "fixed" | "latest",
  targetBuildId: string,
): LibrarySelectionBatchState {
  const buildId = mode === "fixed" ? targetBuildId : null;
  return {
    revision: previous.revision + Number(previous.mode !== mode || previous.buildId !== buildId),
    mode,
    buildId,
  };
}
