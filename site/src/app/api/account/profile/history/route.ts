import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { privateChangeHistoryError } from "../../../../../features/accounts/private-change-history-copy";
import { parseProfileChangeHistoryQuery } from "../../../../../features/accounts/profile-change-history-contract";
import { userPlatformApi } from "../../../../../features/accounts/user-platform-api";
import { profileChangeHistoryService } from "../../../../../lib/services/accounts/profile-change-history-service";
export function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseProfileChangeHistoryQuery(request.nextUrl.searchParams);
      if (!filters)
        throw new AppError("Invalid history filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return profileChangeHistoryService.page(actor.id, filters);
    },
    200,
    privateChangeHistoryError,
  );
}
