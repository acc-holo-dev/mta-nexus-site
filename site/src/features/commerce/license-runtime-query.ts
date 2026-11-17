import { AppError } from "@nexus/domain";
export function licenseRuntimePage(query: URLSearchParams): number {
  for (const key of query.keys())
    if (key !== "page" || query.getAll(key).length !== 1)
      throw new AppError("Invalid license history query", 400, "LICENSE_QUERY_INVALID");
  const page = query.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/u.test(page))
    throw new AppError("Invalid license history page", 400, "LICENSE_QUERY_INVALID");
  return Number(page);
}
