import { AppError, RESOURCE_DELIVERY_STATUSES, type ResourceDeliveryQuery } from "@nexus/domain";
function invalid(): never {
  throw new AppError("Invalid delivery query", 400, "DELIVERY_QUERY_INVALID");
}
function strict(params: URLSearchParams, allowed: readonly string[]) {
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1) invalid();
  const page = params.get("page") ?? "1",
    days = params.get("days") ?? "all";
  if (!/^[1-9]\d{0,3}$/u.test(page) || !["all", "7", "30", "90", "365"].includes(days)) invalid();
  return { page: Number(page), days: days as ResourceDeliveryQuery["days"] };
}
export function resourceDeliveriesQuery(params: URLSearchParams): ResourceDeliveryQuery {
  const value = strict(params, ["page", "days", "status", "resourceId"]),
    status = params.get("status") ?? "all",
    resourceId = params.get("resourceId");
  if (
    (status !== "all" && !RESOURCE_DELIVERY_STATUSES.some((s) => s === status)) ||
    (resourceId !== null && !/^prd_[A-Za-z0-9_-]{1,124}$/u.test(resourceId))
  )
    invalid();
  return { ...value, status: status as ResourceDeliveryQuery["status"], resourceId };
}
export function publisherDeliveriesQuery(params: URLSearchParams) {
  return strict(params, ["page", "days"]);
}
export function resourceDeliveryId(value: string) {
  if (!/^dlv_[A-Za-z0-9_-]{1,124}$/u.test(value)) invalid();
  return value;
}
export function resourceDeliveriesUrl(
  query: ResourceDeliveryQuery,
  path = "/workspace/library/downloads",
) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.days !== "all") params.set("days", query.days);
  if (query.status !== "all") params.set("status", query.status);
  if (query.resourceId) params.set("resourceId", query.resourceId);
  return `${path}${params.size ? `?${params}` : ""}`;
}
export function deliverySearchParams(raw: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  return params;
}
