import { AppError, type LibraryCollectionComparisonQuery } from "@nexus/domain";
import { libraryCollectionComparisonQuerySchema } from "@nexus/validation";
export function libraryCollectionComparisonQuery(
  params: URLSearchParams,
): LibraryCollectionComparisonQuery {
  for (const key of params.keys())
    if (!["to", "page", "filter", "q", "transfer"].includes(key) || params.getAll(key).length !== 1)
      throw new AppError("Invalid comparison query", 400, "COLLECTION_INVALID");
  const page = params.get("page") ?? "1";
  if (!/^[1-9][0-9]{0,3}$/u.test(page))
    throw new AppError("Invalid comparison page", 400, "COLLECTION_INVALID");
  const parsed = libraryCollectionComparisonQuerySchema.safeParse({
    to: params.get("to") || undefined,
    page: Number(page),
    filter: params.get("filter") ?? "all",
    q: params.get("q") ?? "",
    transfer: params.get("transfer") ?? "copy",
  });
  if (!parsed.success) throw new AppError("Invalid comparison query", 400, "COLLECTION_INVALID");
  return parsed.data;
}
export function libraryCollectionComparisonSuffix(query: LibraryCollectionComparisonQuery) {
  return new URLSearchParams({
    ...(query.to ? { to: query.to } : {}),
    page: String(query.page),
    filter: query.filter,
    ...(query.q ? { q: query.q } : {}),
    transfer: query.transfer,
  }).toString();
}
