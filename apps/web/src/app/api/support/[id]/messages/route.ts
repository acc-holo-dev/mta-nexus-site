import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { supportMessageDiscoveryService } from "../../../../../lib/services/support-message-discovery-service";
import { parseSupportMessageQuery } from "../../../../../lib/support-message-discovery-contract";
import { supportMessageError } from "../../../../../lib/support-message-discovery-copy";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      const { id } = await params;
      if (!/^sup_[a-f0-9]{24}$/u.test(id))
        throw new AppError("Support case not found", 404, "NOT_FOUND");
      const filters = parseSupportMessageQuery(request.nextUrl.searchParams);
      if (!filters)
        throw new AppError("Invalid message filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return supportMessageDiscoveryService.page(id, actor.id, filters);
    },
    200,
    supportMessageError,
  );
}
