import {
  libraryCollectionsRepository,
  readLibraryCollectionHistory,
  readLibraryCollectionComparison,
  applyLibraryMembershipBatch,
  readLibraryCollectionReceiptDetail,
  exportLibraryCollection,
  previewLibraryCollectionImport,
  readLibraryMembershipHistory,
  readLibraryMembershipHistoryDetail,
} from "@nexus/db";
import {
  AppError,
  type LibraryCollectionHistoryQuery,
  type LibraryMembershipHistoryQuery,
  type LibraryCollectionComparisonQuery,
  type LibraryReleaseFilter,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
import {
  libraryCollectionCommandSchema,
  libraryMembershipBatchCommandSchema,
} from "@nexus/validation";
import { collectionId } from "../library-collections-query";
export const libraryCollectionsService = {
  receiptDetail: (actor: User, id: string) =>
    readLibraryCollectionReceiptDetail(actor.id, collectionId(id)),
  exportManifest: (actor: User, id: string) => exportLibraryCollection(actor.id, collectionId(id)),
  reconcilePreview: (actor: User, id: string, input: unknown) =>
    previewLibraryCollectionImport(actor.id, collectionId(id), input, true),
  importPreview: (actor: User, id: string, input: unknown) =>
    previewLibraryCollectionImport(actor.id, collectionId(id), input),
  membershipHistory: (actor: User, query: LibraryMembershipHistoryQuery) =>
    readLibraryMembershipHistory(actor.id, query),
  membershipReceipt: (actor: User, id: string) =>
    readLibraryMembershipHistoryDetail(actor.id, collectionId(id)),
  membershipBatch(actor: User, productId: string, input: unknown) {
    const command = libraryMembershipBatchCommandSchema.safeParse(input);
    if (!command.success) throw new AppError("Invalid membership batch", 400, "COLLECTION_INVALID");
    return applyLibraryMembershipBatch({
      userId: actor.id,
      productId: collectionId(productId),
      command: command.data,
      receiptId: generateId("lmb"),
      auditId: generateId("aud"),
      children: command.data.changes.map((change) => ({
        collectionId: change.collectionId,
        receiptId: generateId("lcr"),
        auditId: generateId("aud"),
      })),
    });
  },
  comparison: (actor: User, id: string, query: LibraryCollectionComparisonQuery) =>
    readLibraryCollectionComparison(actor.id, collectionId(id), query),
  accountHistory: (actor: User, query: LibraryCollectionHistoryQuery) =>
    readLibraryCollectionHistory(actor.id, query),
  resourceMemberships: (actor: User, productId: string) =>
    libraryCollectionsRepository.resourceMemberships(actor.id, collectionId(productId)),
  page: (actor: User, query: { page: number; status: "all" | "active" | "archived" }) =>
    libraryCollectionsRepository.page(actor.id, query.page, query.status),
  detail: (actor: User, id: string, query: { page: number; q: string }, candidates = false) =>
    libraryCollectionsRepository.detail(
      actor.id,
      collectionId(id),
      query.page,
      query.q,
      candidates,
    ),
  releases: (
    actor: User,
    id: string,
    query: { page: number; filter: LibraryReleaseFilter; q: string },
  ) =>
    libraryCollectionsRepository.releases(
      actor.id,
      collectionId(id),
      query.page,
      query.filter,
      query.q,
    ),
  copyItemsPage: (actor: User, id: string, query: { page: number; q: string }) =>
    libraryCollectionsRepository.copyItemsPage(actor.id, collectionId(id), query.page, query.q),
  copyPreview: (actor: User, id: string) =>
    libraryCollectionsRepository.copyPreview(actor.id, collectionId(id)),
  history: (actor: User, id: string, page: number) =>
    libraryCollectionsRepository.history(actor.id, collectionId(id), page),
  command(actor: User, input: unknown, id?: string) {
    const parsed = libraryCollectionCommandSchema.safeParse(input);
    if (
      !parsed.success ||
      (parsed.data.action === "create" || parsed.data.action === "duplicate") !== (id === undefined)
    )
      throw new AppError("Invalid collection command", 400, "COLLECTION_INVALID");
    return libraryCollectionsRepository.command({
      userId: actor.id,
      command: parsed.data,
      collectionId: id === undefined ? undefined : collectionId(id),
      newCollectionId: generateId("lcol"),
      receiptId: generateId("lcr"),
      auditId: generateId("aud"),
    });
  },
};
