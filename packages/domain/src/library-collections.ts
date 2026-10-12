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
  | {
      action: "move-items";
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
export type LibraryResourceCollections = {
  schemaVersion: 1;
  generatedAt: string;
  resource: { productId: string; title: string | null; available: boolean; canAdd: boolean };
  collections: (LibraryCollectionSnapshot & { itemCount: number; inCollection: boolean })[];
  collectionLimit: number;
  itemLimit: number;
};
export type LibraryCollectionReceipt = {
  id: string;
  requestId: string;
  command: LibraryCollectionCommand;
  collection: LibraryCollectionSnapshot;
  /** Source successor proved by the immutable move receipt, rather than current state. */
  sourceCollection?: { id: string; revision: number };
  createdAt: Date;
};
export type LibraryCollectionResult = { receipt: LibraryCollectionReceipt; replayed: boolean };
export const LIBRARY_COLLECTION_HISTORY_ACTIONS = [
  "all",
  "create",
  "duplicate",
  "rename",
  "archive",
  "restore",
  "add",
  "remove",
  "add-many",
  "remove-many",
  "copy-items",
  "move-items",
] as const;
export const LIBRARY_COLLECTION_HISTORY_DAYS = [7, 30, 90, 365] as const;
export type LibraryCollectionHistoryQuery = {
  page: number;
  days: (typeof LIBRARY_COLLECTION_HISTORY_DAYS)[number];
  action: (typeof LIBRARY_COLLECTION_HISTORY_ACTIONS)[number];
  collectionId?: string;
  productId?: string;
};
export type LibraryCollectionHistoryPage = {
  schemaVersion: 1;
  generatedAt: string;
  days: LibraryCollectionHistoryQuery["days"];
  action: LibraryCollectionHistoryQuery["action"];
  collectionId: string | null;
  productId: string | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: {
    id: string;
    createdAt: string;
    receipt: LibraryCollectionReceipt | null;
    currentCollection: LibraryCollectionSnapshot | null;
    currentSource: LibraryCollectionSnapshot | null;
    resources: { productId: string; currentTitle: string | null; currentAvailable: boolean }[];
  }[];
};
