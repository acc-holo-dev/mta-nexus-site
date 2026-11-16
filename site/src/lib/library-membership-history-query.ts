import {
  AppError,
  LIBRARY_COLLECTION_HISTORY_DAYS,
  LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS,
  type LibraryMembershipHistoryQuery,
} from "@nexus/domain";
import { libraryCollectionIdSchema } from "@nexus/validation";
export function libraryMembershipHistoryQuery(
  params: URLSearchParams,
): LibraryMembershipHistoryQuery {
  const invalid = () => new AppError("Invalid membership history query", 400, "COLLECTION_INVALID");
  for (const key of params.keys())
    if (
      !["page", "days", "operation", "collectionId", "productId"].includes(key) ||
      params.getAll(key).length !== 1
    )
      throw invalid();
  const page = params.get("page") ?? "1",
    days = params.get("days") ?? "30",
    operation = params.get("operation") ?? "all";
  if (
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    !LIBRARY_COLLECTION_HISTORY_DAYS.some((v) => String(v) === days) ||
    !LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS.some((v) => v === operation)
  )
    throw invalid();
  const ids: { collectionId?: string; productId?: string } = {};
  for (const key of ["collectionId", "productId"] as const) {
    const id = params.get(key);
    if (id === null || id === "") continue;
    if (!libraryCollectionIdSchema.safeParse(id).success) throw invalid();
    ids[key] = id;
  }
  return {
    page: Number(page),
    days: Number(days) as LibraryMembershipHistoryQuery["days"],
    operation: operation as LibraryMembershipHistoryQuery["operation"],
    ...ids,
  };
}
export function libraryMembershipHistorySuffix(query: LibraryMembershipHistoryQuery) {
  return new URLSearchParams({
    page: String(query.page),
    days: String(query.days),
    operation: query.operation,
    ...(query.collectionId ? { collectionId: query.collectionId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
  }).toString();
}
export const membershipHistoryHref = (id?: string) =>
  `/workspace/library/collections/membership-history${id ? `/${encodeURIComponent(id)}` : ""}`;
