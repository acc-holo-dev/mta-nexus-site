import { AppError, type LicenseArchiveFilter } from "@nexus/domain";
export function licenseArchiveQuery(
  params: URLSearchParams,
): LicenseArchiveFilter & { page: number } {
  const allowed = ["page", "status", "binding", "term", "sort", "q"];
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1)
      throw new AppError("Invalid license archive query", 400, "LICENSE_QUERY_INVALID");
  const page = params.get("page") ?? "1",
    status = params.get("status") ?? "all",
    binding = params.get("binding") ?? "all",
    term = params.get("term") ?? "all",
    sort = params.get("sort") ?? "newest",
    q = (params.get("q") ?? "").trim();
  if (
    !/^[1-9]\d{0,3}$/u.test(page) ||
    !["all", "active", "expiring", "expired", "suspended", "revoked"].includes(status) ||
    !["all", "bound", "unbound"].includes(binding) ||
    !["all", "finite", "unknown"].includes(term) ||
    !["newest", "expires_soon"].includes(sort) ||
    q.length > 120 ||
    [...q].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new AppError("Invalid license archive query", 400, "LICENSE_QUERY_INVALID");
  return {
    page: Number(page),
    status: status as LicenseArchiveFilter["status"],
    binding: binding as LicenseArchiveFilter["binding"],
    term: term as LicenseArchiveFilter["term"],
    sort: sort as LicenseArchiveFilter["sort"],
    q,
  };
}
export function licenseArchiveUrl(
  query: LicenseArchiveFilter & { page: number },
  path = "/workspace/licenses",
) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.status !== "all") params.set("status", query.status);
  if (query.binding !== "all") params.set("binding", query.binding);
  if (query.term !== "all") params.set("term", query.term);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.q) params.set("q", query.q);
  return `${path}${params.size ? `?${params}` : ""}`;
}
