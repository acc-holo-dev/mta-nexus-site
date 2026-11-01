import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../../lib/observability";
import { getTrustedRequestIp } from "../../../../../../lib/request-client-ip";
import { authService } from "../../../../../../lib/services/auth-service";
import { resourceQaService } from "../../../../../../lib/services/resource-qa-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> },
) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  try {
    const ip = getTrustedRequestIp(request);
    if (ip !== "unknown" && !(await consumeRateLimit("resourceInspection", `qa-ip:${ip}`)).success)
      throw new RateLimitExceededError();
    const { id, threadId } = await params;
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    return jsonWithRequestId(context, await resourceQaService.threadDetail(id, threadId, actor), {
      headers,
    });
  } catch (error) {
    if (error instanceof AppError)
      return jsonWithRequestId(
        context,
        { code: error.code },
        { status: error.statusCode, headers },
      );
    logRequestEvent({
      level: "error",
      event: "product.qa_thread_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(context, { code: "RESOURCE_QA_UNAVAILABLE" }, { status: 503, headers });
  }
}
