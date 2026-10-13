import { AppError, type LibraryCollectionInventoryQuery } from "@nexus/domain";
import { libraryCollectionInventoryQuerySchema } from "@nexus/validation";
export function libraryCollectionInventoryQuery(
  params: URLSearchParams,
): LibraryCollectionInventoryQuery {
  for (const key of params.keys())
    if (
      !["page", "status", "filter", "q", "collectionId"].includes(key) ||
      params.getAll(key).length !== 1
    )
      throw new AppError("Invalid inventory query", 400, "COLLECTION_INVALID");
  const page = params.get("page") ?? "1";
  if (!/^[1-9][0-9]{0,3}$/u.test(page))
    throw new AppError("Invalid inventory page", 400, "COLLECTION_INVALID");
  const parsed = libraryCollectionInventoryQuerySchema.safeParse({
    page: Number(page),
    status: params.get("status") ?? "all",
    filter: params.get("filter") ?? "all",
    q: params.get("q") ?? "",
    collectionId: params.get("collectionId") || undefined,
  });
  if (!parsed.success) throw new AppError("Invalid inventory query", 400, "COLLECTION_INVALID");
  return parsed.data;
}
export function libraryCollectionInventorySuffix(query: LibraryCollectionInventoryQuery) {
  return new URLSearchParams({
    page: String(query.page),
    status: query.status,
    filter: query.filter,
    ...(query.q ? { q: query.q } : {}),
    ...(query.collectionId ? { collectionId: query.collectionId } : {}),
  }).toString();
}
export const collectionInventoryHref = (collectionId?: string) =>
  `/workspace/library/collections/resources${collectionId ? `?${new URLSearchParams({ collectionId })}` : ""}`;
