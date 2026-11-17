import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { parseDiscoveryStreamQuery } from "../../../../features/discovery/discovery-stream-contract";
import { discoveryStreamError } from "../../../../features/discovery/discovery-stream-copy";
import { publicPlatformApi } from "../../../../features/shell/public-platform-api";
import { getTrustedRequestIp } from "../../../../features/shell/request-client-ip";
import { discoveryService } from "../../../../lib/services/discovery-service";
export async function GET(request: NextRequest) {
  return publicPlatformApi(
    request,
    async () => {
      const filters = parseDiscoveryStreamQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid directory filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
        throw new RateLimitExceededError();
      return discoveryService.stream(filters);
    },
    discoveryStreamError,
  );
}
