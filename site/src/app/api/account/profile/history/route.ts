import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { parseProfileChangeHistoryQuery } from "../../../../../features/accounts/profile-change-history-contract";
import { privateChangeHistoryError } from "../../../../../lib/private-change-history-copy";
import { profileChangeHistoryService } from "../../../../../lib/services/profile-change-history-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
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
