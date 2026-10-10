import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { getTrustedRequestIp } from "./request-client-ip";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";

export async function commercialPublicRequest(
  request: NextRequest,
  operation: () => Promise<unknown>,
) {
  const context = createRequestLogContext(request);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  try {
    if (!(await consumeRateLimit("resourceInspection", getTrustedRequestIp(request))).success)
      throw new RateLimitExceededError();
    return respond(await operation());
  } catch (error) {
    if (error instanceof AppError) return respond({ code: error.code }, error.statusCode);
    logRequestEvent({
      level: "error",
      event: "commercial.catalog_failed",
      context,
      status: 500,
      error,
    });
    return respond({ code: "COMMERCIAL_PLAN_FAILED" }, 500);
  }
}
