import { AppError } from "@nexus/domain";

const invalid = () => new AppError("Invalid subscription request", 400, "SUBSCRIPTION_INVALID");
export function subscriptionId(value: string) {
  if (value.trim() !== value || !/^[A-Za-z0-9_-]{1,160}$/u.test(value)) throw invalid();
  return value;
}
export function subscriptionsQuery(
  params: URLSearchParams,
  mode: "account" | "history" | "estimate" | "activate" | "empty" = "account",
) {
  const allowed =
    mode === "empty"
      ? []
      : mode === "history"
        ? ["organizationId", "page", "days"]
        : mode === "estimate"
          ? ["organizationId", "amount", "currency"]
          : mode === "activate"
            ? ["planId", "revision", "scopePage"]
            : ["organizationId", "scopePage"];
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw invalid();
  const page = params.get("page") ?? "1",
    scopePage = params.get("scopePage") ?? "1",
    days = params.get("days") ?? "all",
    org = params.get("organizationId");
  if (
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    !/^[1-9][0-9]{0,3}$/u.test(scopePage) ||
    !["all", "7", "30", "90", "365"].includes(days)
  )
    throw invalid();
  return {
    page: Number(page),
    scopePage: Number(scopePage),
    days: days === "all" ? ("all" as const) : (Number(days) as 7 | 30 | 90 | 365),
    ...(org !== null ? { organizationId: subscriptionId(org) } : {}),
  };
}
export function subscriptionActivationQuery(params: URLSearchParams) {
  const query = subscriptionsQuery(params, "activate"),
    planId = subscriptionId(params.get("planId") ?? ""),
    revision = params.get("revision") ?? "";
  if (!/^[1-9][0-9]{0,9}$/u.test(revision) || Number(revision) > 2_147_483_646) throw invalid();
  return { ...query, planId, revision: Number(revision) };
}
export function subscriptionEstimateQuery(params: URLSearchParams) {
  const query = subscriptionsQuery(params, "estimate"),
    amount = params.get("amount") ?? "",
    currency = params.get("currency") ?? "";
  if (
    !/^(?:0|[1-9][0-9]{0,8})$/u.test(amount) ||
    Number(amount) > 100_000_000 ||
    !["USD", "EUR", "RUB"].includes(currency)
  )
    throw invalid();
  return { ...query, amount: Number(amount), currency: currency as "USD" | "EUR" | "RUB" };
}
export function subscriptionPageParams(values: Record<string, string | string[] | undefined>) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || (key === "organizationId" && value === "")) continue;
    if (Array.isArray(value)) throw invalid();
    result.set(key, value);
  }
  return result;
}
export function subscriptionAccountHref(organizationId?: string) {
  return `/workspace/subscriptions${organizationId ? `?${new URLSearchParams({ organizationId })}` : ""}`;
}
export function subscriptionReceiptHref(id: string, organizationId?: string) {
  return `/workspace/subscriptions/receipts/${encodeURIComponent(id)}${organizationId ? `?${new URLSearchParams({ organizationId })}` : ""}`;
}
