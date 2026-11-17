import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { parseCommunityReportQuery } from "./community-report-contract";
export function reportId(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(value))
    throw new AppError("Invalid report id", 400, "VALIDATION_ERROR");
  return value;
}
export function reportFilters(params: URLSearchParams) {
  const filters = parseCommunityReportQuery(params);
  if (!filters) throw new AppError("Invalid filters", 400, "VALIDATION_ERROR");
  return filters;
}
export async function reportRateLimit(
  actorId: string,
  category: "report" | "moderationAction" | "search",
) {
  if (!(await consumeRateLimit(category, actorId)).success) throw new RateLimitExceededError();
}
