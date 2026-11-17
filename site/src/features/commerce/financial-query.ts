import { AppError } from "@nexus/domain";
const invalid = () => new AppError("Invalid financial query", 400, "FINANCE_QUERY_INVALID");
function single(query: URLSearchParams, key: string) {
  if (query.getAll(key).length > 1) throw invalid();
  return query.get(key) ?? undefined;
}
function keys(query: URLSearchParams, allowed: string[]) {
  if ([...query.keys()].some((key) => !allowed.includes(key))) throw invalid();
}
function page(query: URLSearchParams) {
  const value = single(query, "page") ?? "1";
  if (!/^[1-9]\d{0,3}$/u.test(value) || Number(value) > 1000) throw invalid();
  return Number(value);
}
export function financialStatementQuery(query: URLSearchParams) {
  keys(query, ["page", "currency", "organizationId"]);
  const currency = single(query, "currency"),
    organizationId = single(query, "organizationId");
  if (currency && !["USD", "EUR", "RUB"].includes(currency)) throw invalid();
  if (organizationId !== undefined && !/^[A-Za-z0-9_-]{1,128}$/u.test(organizationId))
    throw invalid();
  return { page: page(query), currency: currency || undefined, organizationId };
}
export function financialReviewQuery(query: URLSearchParams): {
  page: number;
  filter: "all" | "review";
} {
  keys(query, ["page", "filter"]);
  const filter = single(query, "filter") ?? "review";
  if (filter !== "all" && filter !== "review") throw invalid();
  return { page: page(query), filter };
}
export function financialPageQuery(query: URLSearchParams) {
  keys(query, ["page"]);
  return page(query);
}
