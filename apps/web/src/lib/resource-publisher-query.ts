import {
  AppError,
  PRODUCT_TYPES,
  RESOURCE_READINESS,
  type PublisherResourceQuery,
  type PublisherHistoryKind,
} from "@nexus/domain";
const statuses = ["draft", "pending_review", "published", "suspended", "archived"] as const;
function invalid(): never {
  throw new AppError("Invalid publisher query", 400, "RESOURCE_PUBLISHER_QUERY_INVALID");
}
function strict(params: URLSearchParams, allowed: string[]) {
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1) invalid();
  const page = params.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/u.test(page)) invalid();
  return Number(page);
}
export function resourcePublisherQuery(
  params: URLSearchParams,
): PublisherResourceQuery & { page: number } {
  const page = strict(params, ["page", "status", "type", "scope", "readiness", "sort", "q"]),
    status = params.get("status") ?? "all",
    type = params.get("type") ?? "all",
    scope = params.get("scope") ?? "all",
    readiness = params.get("readiness") ?? "all",
    sort = params.get("sort") ?? "updated",
    q = (params.get("q") ?? "").trim();
  if (
    (status !== "all" && !statuses.some((value) => value === status)) ||
    (type !== "all" && !PRODUCT_TYPES.some((value) => value === type)) ||
    !["all", "personal", "organization"].includes(scope) ||
    (readiness !== "all" && !RESOURCE_READINESS.some((value) => value === readiness)) ||
    !["updated", "created", "title"].includes(sort) ||
    q.length > 120 ||
    [...q].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    invalid();
  return {
    page,
    status: status as PublisherResourceQuery["status"],
    type: type as PublisherResourceQuery["type"],
    scope: scope as PublisherResourceQuery["scope"],
    readiness: readiness as PublisherResourceQuery["readiness"],
    sort: sort as PublisherResourceQuery["sort"],
    q,
  };
}
export function resourcePublisherUrl(query: PublisherResourceQuery & { page: number }) {
  const params = new URLSearchParams();
  for (const key of ["status", "type", "scope", "readiness"] as const)
    if (query[key] !== "all") params.set(key, query[key]);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.sort !== "updated") params.set("sort", query.sort);
  if (query.q) params.set("q", query.q);
  return `/workspace/resources${params.size ? `?${params}` : ""}`;
}
export function resourcePublisherHistoryQuery(params: URLSearchParams) {
  const page = strict(params, ["page", "kind"]),
    kind = params.get("kind") ?? "all";
  if (!["all", "changes", "publication"].includes(kind)) invalid();
  return { page, kind: kind as PublisherHistoryKind };
}
export function publisherSearchParams(raw: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  return params;
}
