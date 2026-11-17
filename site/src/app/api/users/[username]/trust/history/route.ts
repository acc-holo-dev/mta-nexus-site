import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { getTrustedRequestIp } from "../../../../../../features/shell/request-client-ip";
import { parseApprovalQuery } from "../../../../../../features/trust/public-verification-history-contract";
import { approvalError } from "../../../../../../features/trust/public-verification-history-copy";
import { publicPlatformApi } from "../../../../../../lib/http/public-platform-api";
import { publicVerificationHistoryService } from "../../../../../../lib/services/trust/public-verification-history-service";
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
