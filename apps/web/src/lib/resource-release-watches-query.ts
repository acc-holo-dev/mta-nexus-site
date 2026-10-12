import { AppError, type ResourceReleaseWatchFilter } from "@nexus/domain";
export function resourceReleaseWatchesQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (!["filter", "page", "query"].includes(key) || params.getAll(key).length !== 1)
      throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_QUERY_INVALID");
  const page = params.get("page") ?? "1",
    filter = params.get("filter") ?? "all",
    query = (params.get("query") ?? "").trim();
  if (
    !/^[1-9]\d{0,3}$/u.test(page) ||
    Number(page) > 1000 ||
    query.length > 100 ||
    !["all", "enabled", "disabled", "unavailable"].includes(filter)
  )
    throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_QUERY_INVALID");
  return { page: Number(page), filter: filter as ResourceReleaseWatchFilter, query };
}
export function resourceReleaseWatchesUrl(
  filter: ResourceReleaseWatchFilter,
  page = 1,
  query = "",
) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("query", query);
  if (page > 1) params.set("page", String(page));
  return `/workspace/library/watches${params.size ? `?${params}` : ""}`;
}
