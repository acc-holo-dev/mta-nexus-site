import { AppError } from "@nexus/domain";
export function resourceReviewQuery(params: URLSearchParams, reports = false) {
  const allowed = reports ? ["page", "view"] : ["page"];
  if (
    [...params.keys()].some((key) => !allowed.includes(key)) ||
    allowed.some((key) => params.getAll(key).length > 1)
  )
    throw new AppError("Invalid review query", 400, "REVIEW_QUERY_INVALID");
  const page = params.get("page") ?? "1",
    view = params.get("view") ?? "pending";
  if (!/^[1-9]\d{0,3}$/u.test(page) || (reports && !["pending", "history"].includes(view)))
    throw new AppError("Invalid review query", 400, "REVIEW_QUERY_INVALID");
  return { page: Number(page), view: view as "pending" | "history" };
}
export function resourceReviewPageQuery(
  params: Record<string, string | string[] | undefined>,
  reports = false,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (value !== undefined) query.append(key, value);
  }
  return resourceReviewQuery(query, reports);
}
