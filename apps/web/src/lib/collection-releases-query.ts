import { AppError, LIBRARY_RELEASE_FILTERS } from "@nexus/domain";
import type { LibraryReleaseFilter } from "@nexus/domain";
import { collectionsQuery } from "./library-collections-query";
export function collectionReleasesQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (!["page", "q", "filter"].includes(key) || params.getAll(key).length !== 1)
      throw new AppError("Invalid releases query", 400, "COLLECTION_INVALID");
  const filter = params.get("filter") ?? "all";
  if (!LIBRARY_RELEASE_FILTERS.includes(filter as LibraryReleaseFilter))
    throw new AppError("Invalid releases filter", 400, "COLLECTION_INVALID");
  const detail = new URLSearchParams(params);
  detail.delete("filter");
  const { page, q } = collectionsQuery(detail, "detail");
  return { page, q, filter: filter as LibraryReleaseFilter };
}
