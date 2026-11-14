import {
  AppError,
  LIBRARY_COLLECTION_HISTORY_ACTIONS,
  LIBRARY_COLLECTION_HISTORY_DAYS,
  type LibraryCollectionHistoryQuery,
} from "@nexus/domain";
import { libraryCollectionIdSchema } from "@nexus/validation";
const invalid = () => new AppError("Invalid collection history query", 400, "COLLECTION_INVALID");
export function libraryCollectionHistoryQuery(
  params: URLSearchParams,
): LibraryCollectionHistoryQuery {
  for (const key of params.keys())
    if (
      !["page", "days", "action", "collectionId", "productId"].includes(key) ||
      params.getAll(key).length !== 1
    )
      throw invalid();
  const page = params.get("page") ?? "1",
    days = params.get("days") ?? "30",
    action = params.get("action") ?? "all";
  if (
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    !LIBRARY_COLLECTION_HISTORY_DAYS.some((v) => String(v) === days) ||
    !LIBRARY_COLLECTION_HISTORY_ACTIONS.some((v) => v === action)
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
    days: Number(days) as LibraryCollectionHistoryQuery["days"],
    action: action as LibraryCollectionHistoryQuery["action"],
    ...ids,
  };
}
export function libraryCollectionHistorySuffix(query: LibraryCollectionHistoryQuery) {
  return new URLSearchParams({
    page: String(query.page),
    days: String(query.days),
    action: query.action,
    ...(query.collectionId ? { collectionId: query.collectionId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
  }).toString();
}
