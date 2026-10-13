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
  | {
      action: "reconcile-items";
      addProductIds: string[];
      removeProductIds: string[];
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
export type LibraryMembershipBatchCommand = {
  requestId: string;
  changes: {
    collectionId: string;
    expectedRevision: number;
    wasInCollection: boolean;
    inCollection: boolean;
  }[];
};
export type LibraryMembershipBatchReceipt = {
  id: string;
  requestId: string;
  productId: string;
  command: LibraryMembershipBatchCommand;
  children: LibraryCollectionReceipt[];
  createdAt: Date;
};
export type LibraryMembershipBatchResult = {
  receipt: LibraryMembershipBatchReceipt;
  replayed: boolean;
};
export const LIBRARY_COLLECTION_COMPARISON_FILTERS = [
  "all",
  "source-only",
  "destination-only",
  "common",
  "unavailable",
] as const;
export type LibraryCollectionComparisonQuery = {
  to?: string;
  page: number;
  filter: (typeof LIBRARY_COLLECTION_COMPARISON_FILTERS)[number];
  q: string;
  transfer: "copy" | "move";
};
export type LibraryCollectionComparison = {
  schemaVersion: 1;
  generatedAt: string;
  source: LibraryCollectionSnapshot & { itemCount: number };
  targets: (LibraryCollectionSnapshot & { itemCount: number })[];
  itemLimit: number;
  comparison: null | {
    destination: LibraryCollectionSnapshot & { itemCount: number };
    counts: {
      all: number;
      sourceOnly: number;
      destinationOnly: number;
      common: number;
      unavailable: number;
    };
    items: {
      productId: string;
      title: string | null;
      available: boolean;
      inSource: boolean;
      inDestination: boolean;
    }[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    filter: LibraryCollectionComparisonQuery["filter"];
    q: string;
    transfer: LibraryCollectionComparisonQuery["transfer"];
  };
};
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
  "reconcile-items",
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

export const LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS = [
  "all",
  "additions",
  "removals",
  "mixed",
] as const;
export type LibraryMembershipHistoryQuery = {
  page: number;
  days: (typeof LIBRARY_COLLECTION_HISTORY_DAYS)[number];
  operation: (typeof LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS)[number];
  collectionId?: string;
  productId?: string;
};
export type LibraryMembershipHistoryItem = {
  id: string;
  createdAt: string;
  receipt: LibraryMembershipBatchReceipt | null;
  resource: { productId: string; currentTitle: string | null; currentAvailable: boolean } | null;
  collections: {
    collectionId: string;
    current: LibraryCollectionSnapshot | null;
    inCollection: boolean | null;
  }[];
};
export type LibraryMembershipHistoryDetail = {
  schemaVersion: 1;
  generatedAt: string;
  item: LibraryMembershipHistoryItem;
};
export type LibraryMembershipHistoryPage = Omit<
  LibraryMembershipHistoryQuery,
  "collectionId" | "productId"
> & {
  schemaVersion: 1;
  generatedAt: string;
  collectionId: string | null;
  productId: string | null;
  pageSize: number;
  total: number;
  totalPages: number;
  items: LibraryMembershipHistoryItem[];
};

export const LIBRARY_COLLECTION_MANIFEST_BYTES = 64 * 1024;
export type LibraryCollectionManifest = {
  schemaVersion: 1;
  generatedAt: string;
  collection: LibraryCollectionSnapshot;
  productIds: string[];
};
export type LibraryCollectionImportPreview = {
  schemaVersion: 1;
  generatedAt: string;
  collection: LibraryCollectionSnapshot;
  itemCount: number;
  itemLimit: number;
  batchLimit: number;
  items: {
    productId: string;
    title: string | null;
    available: boolean;
    inCollection: boolean;
    canAdd: boolean;
  }[];
};

export type LibraryCollectionReconcilePreview = Omit<LibraryCollectionImportPreview, "items"> & {
  items: (LibraryCollectionImportPreview["items"][number] & {
    inManifest: boolean;
    canRemove: boolean;
  })[];
};
export function collectionCommandProductIds(command: LibraryCollectionCommand): string[] {
  return command.action === "reconcile-items"
    ? [...command.addProductIds, ...command.removeProductIds].sort()
    : "productIds" in command
      ? command.productIds
      : "productId" in command
        ? [command.productId]
        : [];
}
