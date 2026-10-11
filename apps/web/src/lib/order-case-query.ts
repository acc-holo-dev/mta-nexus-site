import {
  AppError,
  ORDER_CASE_REVIEW_STATUSES,
  type OrderCaseReviewStatus,
  type SupportCaseStatus,
} from "@nexus/domain";
export function orderCaseQuery(query: URLSearchParams, filters = false) {
  const invalid = () =>
    new AppError("Invalid purchase case filters", 400, "ORDER_CASE_QUERY_INVALID");
  const allowed = filters ? ["page", "reviewStatus", "threadStatus"] : ["page"];
  for (const key of query.keys())
    if (!allowed.includes(key) || query.getAll(key).length !== 1) throw invalid();
  const value = query.get("page") ?? "1";
  if (!/^[1-9]\d{0,3}$/u.test(value)) throw invalid();
  const review = query.get("reviewStatus") || undefined,
    thread = query.get("threadStatus") || undefined;
  if (review && !(ORDER_CASE_REVIEW_STATUSES as readonly string[]).includes(review))
    throw invalid();
  if (thread && !["open", "resolved", "closed"].includes(thread)) throw invalid();
  return {
    page: Number(value),
    reviewStatus: review as OrderCaseReviewStatus | undefined,
    threadStatus: thread as SupportCaseStatus | undefined,
  };
}
export function orderCasePageQuery(
  query: Record<string, string | string[] | undefined>,
  filters = false,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  return orderCaseQuery(params, filters);
}
