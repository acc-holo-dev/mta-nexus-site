import type { BuildPackageFilter } from "@nexus/domain";
const keys = ["page", "baseline", "filter"];
export function parseBuildPackageQuery(params: URLSearchParams) {
  if ([...params.keys()].some((key) => !keys.includes(key) || params.getAll(key).length !== 1))
    return null;
  const page = params.get("page") ?? "1",
    baseline = params.get("baseline"),
    filter = params.get("filter") ?? "all";
  if (
    !/^[1-9][0-9]{0,4}$/u.test(page) ||
    (baseline !== null && !/^bld_[A-Za-z0-9_-]{1,128}$/u.test(baseline)) ||
    !["all", "added", "removed", "changed", "unchanged"].includes(filter)
  )
    return null;
  return {
    page: Number(page),
    baselineId: baseline ?? undefined,
    filter: filter as BuildPackageFilter,
  };
}
export function buildPackageQueryHref(
  base: string,
  query: { page?: number; baselineId?: string; filter?: BuildPackageFilter },
) {
  const params = new URLSearchParams();
  if (query.baselineId) params.set("baseline", query.baselineId);
  if (query.filter && query.filter !== "all") params.set("filter", query.filter);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return `${base}${params.size ? `?${params}` : ""}`;
}
