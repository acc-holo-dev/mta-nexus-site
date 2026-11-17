import {
  AppError,
  COMMERCIAL_CURRENCIES,
  type CommercialCurrency,
  type CommercialPlanStatus,
} from "@nexus/domain";

const invalid = () => new AppError("Invalid commerce query", 400, "COMMERCIAL_PLAN_INVALID");
function single(query: URLSearchParams, key: string, fallback?: string) {
  if (query.getAll(key).length > 1) throw invalid();
  return query.get(key) ?? fallback;
}
function keys(query: URLSearchParams, allowed: string[]) {
  if ([...query.keys()].some((key) => !allowed.includes(key))) throw invalid();
}
function integer(value: string | undefined, min: number, max: number) {
  if (
    !value ||
    !/^(?:0|[1-9]\d*)$/u.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw invalid();
  return Number(value);
}
export function commercialCatalogQuery(query: URLSearchParams) {
  keys(query, ["scope", "page"]);
  const scope = single(query, "scope", "user");
  if (scope !== "user" && scope !== "organization") throw invalid();
  return {
    scope: scope as "user" | "organization",
    page: integer(single(query, "page", "1"), 1, 1000),
  };
}
export function commercialAdminQuery(query: URLSearchParams) {
  keys(query, ["status", "page"]);
  const status = single(query, "status");
  if (status !== undefined && status !== "draft" && status !== "published" && status !== "archived")
    throw invalid();
  return {
    status: status as CommercialPlanStatus | undefined,
    page: integer(single(query, "page", "1"), 1, 1000),
  };
}
export function commercialQuoteQuery(query: URLSearchParams) {
  keys(query, ["amount", "currency", "planId", "revision"]);
  const amount = integer(single(query, "amount"), 0, 100_000_000);
  const currency = single(query, "currency");
  if (!COMMERCIAL_CURRENCIES.some((value) => value === currency)) throw invalid();
  const planId = single(query, "planId"),
    revision = single(query, "revision");
  if (
    (planId === undefined) !== (revision === undefined) ||
    (planId !== undefined && !/^[A-Za-z0-9_-]{1,128}$/u.test(planId))
  )
    throw invalid();
  return {
    amount,
    currency: currency as CommercialCurrency,
    planId,
    revision: revision === undefined ? undefined : integer(revision, 1, 2_147_483_647),
  };
}
