import { AppError } from "@nexus/domain";

const invalid = () => new AppError("Invalid plan review request", 400, "PLAN_REVIEW_INVALID");
export function planReviewId(value: string) {
  if (value.trim() !== value || !/^[A-Za-z0-9_-]{1,160}$/u.test(value)) throw invalid();
  return value;
}
export function planReviewsQuery(params: URLSearchParams, detail = false) {
  const allowed = detail ? ["organizationId"] : ["organizationId", "page", "days", "scopePage"];
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1) throw invalid();
  const page = params.get("page") ?? "1",
    scopePage = params.get("scopePage") ?? "1",
    days = params.get("days") ?? "all",
    organizationId = params.get("organizationId");
  if (
    page.trim() !== page ||
    scopePage.trim() !== scopePage ||
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    !/^[1-9][0-9]{0,3}$/u.test(scopePage) ||
    !["all", "7", "30", "90", "365"].includes(days)
  )
    throw invalid();
  return {
    page: Number(page),
    scopePage: Number(scopePage),
    days: days === "all" ? ("all" as const) : (Number(days) as 7 | 30 | 90 | 365),
    ...(organizationId !== null ? { organizationId: planReviewId(organizationId) } : {}),
  };
}
export function planReviewsPageParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, v] of Object.entries(values)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) throw invalid();
    params.set(key, v);
  }
  return params;
}
export function planReviewHref(id: string, organizationId?: string) {
  return `/workspace/subscriptions/reviews/${encodeURIComponent(id)}${organizationId ? `?${new URLSearchParams({ organizationId })}` : ""}`;
}
export function planReviewNewQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (!["planId", "revision", "scopePage"].includes(key) || params.getAll(key).length !== 1)
      throw invalid();
  const planId = planReviewId(params.get("planId") ?? ""),
    revision = params.get("revision") ?? "",
    scopePage = params.get("scopePage") ?? "1";
  if (
    revision.trim() !== revision ||
    !/^[1-9][0-9]{0,9}$/u.test(revision) ||
    Number(revision) > 2_147_483_646 ||
    scopePage.trim() !== scopePage ||
    !/^[1-9][0-9]{0,3}$/u.test(scopePage)
  )
    throw invalid();
  return { planId, revision: Number(revision), scopePage: Number(scopePage) };
}
