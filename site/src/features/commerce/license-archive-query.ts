import { AppError, type LicenseArchiveFilter } from "@nexus/domain";

export type LicenseArchiveListQuery = LicenseArchiveFilter & { page: number };

export type LicenseModerationListQuery = {
  page: number;
  status: string;
  q: string;
};

const MODERATION_STATUSES = ["active", "expired", "revoked", "suspended"] as const;

export function licenseArchiveQuery(params: URLSearchParams): LicenseArchiveListQuery {
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

export function licenseArchivePageQuery(
  query: Record<string, string | string[] | undefined>,
): LicenseArchiveListQuery {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  return licenseArchiveQuery(params);
}

export function licenseArchiveUrl(query: LicenseArchiveListQuery, path = "/workspace/licenses") {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.status !== "all") params.set("status", query.status);
  if (query.binding !== "all") params.set("binding", query.binding);
  if (query.term !== "all") params.set("term", query.term);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.q) params.set("q", query.q);
  return `${path}${params.size ? `?${params}` : ""}`;
}

export function licenseArchiveListHref(
  query: LicenseArchiveListQuery,
  path = "/workspace/licenses",
) {
  return licenseArchiveUrl(query, path);
}

export function licenseArchiveDetailHref(
  licenseId: string,
  query: LicenseArchiveListQuery,
  path = "/workspace/licenses",
) {
  const listHref = licenseArchiveUrl(query, path);
  const queryStart = listHref.indexOf("?");
  const suffix = queryStart >= 0 ? listHref.slice(queryStart) : "";
  return `${path}/${encodeURIComponent(licenseId)}${suffix}`;
}

export function licenseModerationQuery(
  query: Record<string, string | string[] | undefined>,
): LicenseModerationListQuery {
  const status =
    typeof query.status === "string" &&
    (MODERATION_STATUSES as readonly string[]).includes(query.status)
      ? query.status
      : "";
  const text = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const page =
    typeof query.page === "string" && /^[1-9][0-9]{0,5}$/u.test(query.page)
      ? Math.min(Number(query.page), 1000)
      : 1;
  return { page, status, q: text };
}

export function licenseModerationListHref(query: LicenseModerationListQuery) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.page > 1) params.set("page", String(query.page));
  return `/admin/licenses${params.size ? `?${params}` : ""}`;
}

export function licenseModerationDetailHref(licenseId: string, query: LicenseModerationListQuery) {
  const listHref = licenseModerationListHref(query);
  const queryStart = listHref.indexOf("?");
  const suffix = queryStart >= 0 ? listHref.slice(queryStart) : "";
  return `/admin/licenses/${encodeURIComponent(licenseId)}${suffix}`;
}
