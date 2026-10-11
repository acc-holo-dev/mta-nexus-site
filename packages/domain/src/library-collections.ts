export const LIBRARY_COLLECTION_LIMIT = 30;
export const LIBRARY_COLLECTION_ITEM_LIMIT = 200;
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
  | { action: "rename"; name: string; expectedRevision: number }
  | { action: "archive" | "restore"; expectedRevision: number }
  | { action: "add" | "remove"; productId: string; expectedRevision: number }
);
export type LibraryCollectionReceipt = {
  id: string;
  requestId: string;
  command: LibraryCollectionCommand;
  collection: LibraryCollectionSnapshot;
  createdAt: Date;
};
export type LibraryCollectionResult = { receipt: LibraryCollectionReceipt; replayed: boolean };
