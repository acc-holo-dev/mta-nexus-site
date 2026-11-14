import {
  AppError,
  LIBRARY_RELEASE_HISTORY_DAYS,
  type LibraryReleaseHistoryDays,
} from "@nexus/domain";
import { resourceControlPageQuery } from "./resource-release-control-query";
export function libraryReleaseHistoryQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (!["page", "days", "productId"].includes(key) || params.getAll(key).length !== 1)
      throw new AppError("Invalid selection history query", 400, "RESOURCE_CONTROL_INVALID");
  const raw = params.get("days") ?? "30",
    productId = params.get("productId") || undefined;
  if (
    !LIBRARY_RELEASE_HISTORY_DAYS.map(String).includes(raw) ||
    (productId !== undefined && !/^[A-Za-z0-9_-]{1,160}$/u.test(productId))
  )
    throw new AppError("Invalid selection history filters", 400, "RESOURCE_CONTROL_INVALID");
  const page = resourceControlPageQuery(
    new URLSearchParams(params.has("page") ? { page: params.get("page") ?? "" } : {}),
  );
  return {
    page,
    days: Number(raw) as LibraryReleaseHistoryDays,
    ...(productId !== undefined ? { productId } : {}),
  };
}
