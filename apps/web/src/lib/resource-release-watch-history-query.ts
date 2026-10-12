import {
  AppError,
  RESOURCE_RELEASE_WATCH_HISTORY_SOURCES,
  type ResourceReleaseWatchHistoryQuery,
} from "@nexus/domain";
import { libraryReleaseHistoryQuery } from "./library-release-history-query";
export function resourceReleaseWatchHistoryQuery(
  params: URLSearchParams,
): ResourceReleaseWatchHistoryQuery {
  for (const key of params.keys())
    if (!["page", "days", "productId", "source"].includes(key) || params.getAll(key).length !== 1)
      throw new AppError("Invalid watch history query", 400, "RELEASE_WATCH_QUERY_INVALID");
  const source = params.get("source") ?? "all";
  if (!RESOURCE_RELEASE_WATCH_HISTORY_SOURCES.some((value) => value === source))
    throw new AppError("Invalid watch history source", 400, "RELEASE_WATCH_QUERY_INVALID");
  const base = new URLSearchParams(params);
  base.delete("source");
  return {
    ...libraryReleaseHistoryQuery(base),
    source: source as ResourceReleaseWatchHistoryQuery["source"],
  };
}
