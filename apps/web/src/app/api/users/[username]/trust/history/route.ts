import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { publicPlatformApi } from "../../../../../../lib/public-platform-api";
import { getTrustedRequestIp } from "../../../../../../lib/request-client-ip";
import { publicVerificationHistoryService } from "../../../../../../lib/services/public-verification-history-service";
import { parseApprovalQuery } from "../../../../../../lib/public-verification-history-contract";
import { approvalError } from "../../../../../../lib/public-verification-history-copy";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  return publicPlatformApi(
    request,
    async () => {
      const filters = parseApprovalQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid approval filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
        throw new RateLimitExceededError();
      return publicVerificationHistoryService.page((await params).username, filters);
    },
    approvalError,
  );
}
