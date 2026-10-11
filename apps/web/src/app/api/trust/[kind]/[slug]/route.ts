import type { NextRequest } from "next/server";
import { AppError, NotFoundError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { publicPlatformApi } from "../../../../../lib/public-platform-api";
import { getTrustedRequestIp } from "../../../../../lib/request-client-ip";
import {
  parseContextKind,
  parseContextTrustQuery,
} from "../../../../../lib/public-context-trust-contract";
import { contextTrustError } from "../../../../../lib/public-context-trust-copy";
import { publicContextTrustService } from "../../../../../lib/services/public-context-trust-service";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; slug: string }> },
) {
  return publicPlatformApi(
    request,
    async () => {
      const path = await params,
        kind = parseContextKind(path.kind),
        filters = parseContextTrustQuery(request.nextUrl.searchParams);
      if (!kind) throw new NotFoundError("Context");
      if (!filters) throw new AppError("Invalid approval filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
        throw new RateLimitExceededError();
      return publicContextTrustService.page(kind, path.slug, filters);
    },
    contextTrustError,
  );
}
