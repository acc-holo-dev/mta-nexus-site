import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { getTrustedRequestIp } from "../../../../../features/shell/request-client-ip";
import { trustError } from "../../../../../features/trust/public-user-trust-copy";
import { publicPlatformApi } from "../../../../../lib/public-platform-api";
import { publicUserTrustService } from "../../../../../lib/services/public-user-trust-service";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  return publicPlatformApi(
    request,
    async () => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
        throw new RateLimitExceededError();
      return publicUserTrustService.get((await params).username);
    },
    trustError,
  );
}
