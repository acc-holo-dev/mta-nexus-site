import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { publicPlatformApi } from "../../../../lib/public-platform-api";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";
import { parseDiscoveryStreamQuery } from "../../../../lib/discovery-stream-contract";
import { discoveryStreamError } from "../../../../lib/discovery-stream-copy";
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
