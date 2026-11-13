import { AppError, type LibraryCollectionInventoryQuery } from "@nexus/domain";
import { libraryCollectionInventoryQuerySchema } from "@nexus/validation";
export function libraryCollectionInventoryQuery(
  params: URLSearchParams,
): LibraryCollectionInventoryQuery {
  for (const key of params.keys())
    if (
      !["page", "status", "filter", "q", "collectionId", "release"].includes(key) ||
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
    release: params.get("release") ?? "all",
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
    ...(query.release && query.release !== "all" ? { release: query.release } : {}),
  }).toString();
}
export function collectionInventoryHref(
  collectionId?: string,
  release?: LibraryCollectionInventoryQuery["release"],
) {
  const params = new URLSearchParams({
    ...(collectionId ? { collectionId } : {}),
    ...(release && release !== "all" ? { release } : {}),
  });
  return `/workspace/library/collections/resources${params.size ? `?${params}` : ""}`;
}
