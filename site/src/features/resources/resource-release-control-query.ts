import { AppError, LIBRARY_RELEASE_FILTERS, type ProductStatus } from "@nexus/domain";
const invalid = () =>
  new AppError("Invalid resource control query", 400, "RESOURCE_CONTROL_INVALID");
function single(query: URLSearchParams, key: string, fallback?: string) {
  if (query.getAll(key).length > 1) throw invalid();
  return query.get(key) ?? fallback;
}
function keys(query: URLSearchParams, allowed: string[]) {
  if ([...query.keys()].some((key) => !allowed.includes(key))) throw invalid();
}
function page(query: URLSearchParams) {
  const value = single(query, "page", "1");
  if (!value || !/^[1-9]\d{0,3}$/u.test(value) || Number(value) > 1000) throw invalid();
  return Number(value);
}
export function resourceControlPageQuery(query: URLSearchParams) {
  keys(query, ["page"]);
  return page(query);
}
export function libraryReleaseQuery(query: URLSearchParams) {
  keys(query, ["page", "filter"]);
  const filter = single(query, "filter", "all");
  const matched = LIBRARY_RELEASE_FILTERS.find((value) => value === filter);
  if (!matched) throw invalid();
  return { page: page(query), filter: matched };
}
export function resourceModerationQuery(query: URLSearchParams) {
  keys(query, ["page", "status", "query"]);
  const status = single(query, "status"),
    search = single(query, "query", "") ?? "";
  if (
    status !== undefined &&
    !["draft", "pending_review", "published", "suspended", "archived"].includes(status)
  )
    throw invalid();
  if (search.length > 100) throw invalid();
  return { page: page(query), status: status as ProductStatus | undefined, query: search.trim() };
}
