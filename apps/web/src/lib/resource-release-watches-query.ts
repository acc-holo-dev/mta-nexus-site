import { AppError, type ResourceReleaseWatchFilter } from "@nexus/domain";
export function resourceReleaseWatchesQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (!["filter", "page"].includes(key) || params.getAll(key).length !== 1)
      throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_QUERY_INVALID");
  const page = params.get("page") ?? "1",
    filter = params.get("filter") ?? "all";
  if (
    !/^[1-9]\d{0,3}$/u.test(page) ||
    !["all", "enabled", "disabled", "unavailable"].includes(filter)
  )
    throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_QUERY_INVALID");
  return { page: Number(page), filter: filter as ResourceReleaseWatchFilter };
}
export function resourceReleaseWatchesUrl(filter: ResourceReleaseWatchFilter, page = 1) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  return `/workspace/library/watches${params.size ? `?${params}` : ""}`;
}
