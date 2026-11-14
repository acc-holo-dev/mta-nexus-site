import type { ManagedServerFilters } from "@nexus/db";

export function parseManagedServerQuery(query: Record<string, string | string[] | undefined>) {
  const filters: ManagedServerFilters = {};
  if (typeof query.q === "string") filters.query = query.q.trim().slice(0, 120);
  if (
    query.status === "active" ||
    query.status === "inactive" ||
    query.status === "maintenance" ||
    query.status === "suspended"
  )
    filters.status = query.status;
  if (
    query.visibility === "public" ||
    query.visibility === "unlisted" ||
    query.visibility === "private"
  )
    filters.visibility = query.visibility;
  if (query.verification === "verified" || query.verification === "unverified")
    filters.verification = query.verification;
  const page =
    typeof query.page === "string" && /^[1-9][0-9]{0,5}$/u.test(query.page)
      ? Number(query.page)
      : 1;
  return { filters, page };
}

export function managedServerHref(filters: ManagedServerFilters = {}, page = 1) {
  const query = new URLSearchParams();
  if (filters.query) query.set("q", filters.query);
  if (filters.status) query.set("status", filters.status);
  if (filters.visibility) query.set("visibility", filters.visibility);
  if (filters.verification) query.set("verification", filters.verification);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `/workspace/servers${suffix ? `?${suffix}` : ""}`;
}

export { getManagedServerCopy } from "./managed-server-copy";
