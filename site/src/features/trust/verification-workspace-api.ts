import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { parseVerificationQuery } from "./verification-workspace-contract";
export function verificationFilters(params: URLSearchParams, targets = false) {
  const filters = parseVerificationQuery(params, targets);
  if (!filters) throw new AppError("Invalid filters", 400, "VALIDATION_ERROR");
  return filters;
}
export async function verificationRate(
  actorId: string,
  kind: "search" | "verification" | "moderationAction" | "profileEditing",
) {
  if (!(await consumeRateLimit(kind, actorId)).success) throw new RateLimitExceededError();
}
