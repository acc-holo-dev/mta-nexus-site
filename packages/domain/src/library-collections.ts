export const LIBRARY_COLLECTION_LIMIT = 30;
export const LIBRARY_COLLECTION_ITEM_LIMIT = 200;
export const LIBRARY_COLLECTION_BATCH_LIMIT = 20;
export const LIBRARY_COLLECTION_COMMAND_BYTES = 8192;
export const LIBRARY_COLLECTION_COMMAND_LIMIT = 5000;
export type LibraryCollectionStatus = "active" | "archived";
export type LibraryCollectionSnapshot = {
  id: string;
  name: string;
  status: LibraryCollectionStatus;
  revision: number;
};
export type LibraryCollectionCommand = { requestId: string } & (
  | { action: "create"; name: string }
  | {
      action: "duplicate";
      name: string;
      sourceCollectionId: string;
      expectedRevision: number;
      expectedItemCount: number;
      sourceDigest: string;
    }
  | { action: "rename"; name: string; expectedRevision: number }
  | { action: "archive" | "restore"; expectedRevision: number }
  | { action: "add" | "remove"; productId: string; expectedRevision: number }
  | {
      action: "copy-items";
      sourceCollectionId: string;
      expectedSourceRevision: number;
      productIds: string[];
      expectedRevision: number;
    }
  | { action: "add-many" | "remove-many"; productIds: string[]; expectedRevision: number }
);
export type LibraryCollectionCopyPreview = {
  source: LibraryCollectionSnapshot;
  itemCount: number;
  sourceDigest: string;
};
export type LibraryCollectionReceipt = {
  id: string;
  requestId: string;
  command: LibraryCollectionCommand;
  collection: LibraryCollectionSnapshot;
  createdAt: Date;
};
export type LibraryCollectionResult = { receipt: LibraryCollectionReceipt; replayed: boolean };
