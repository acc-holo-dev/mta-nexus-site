import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import {
  resourceQaCopy,
  resourceQaError,
} from "../../../../../../features/resources/resource-qa-i18n";
import { getTrustedRequestIp } from "../../../../../../features/shell/request-client-ip";
import { resolveLocale } from "../../../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../../../lib/platform/observability";
import { authService } from "../../../../../../lib/services/accounts/auth-service";
import { resourceQaService } from "../../../../../../lib/services/resources/resource-qa-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> },
) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const copy = resourceQaCopy(locale);
  try {
    const ip = getTrustedRequestIp(request);
    if (!(await consumeRateLimit("resourceInspection", `qa-ip:${ip}`)).success)
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
        { code: error.code, error: resourceQaError(locale, error.code) },
        { status: error.statusCode, headers },
      );
    logRequestEvent({
      level: "error",
      event: "product.qa_thread_fetch_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      { code: "RESOURCE_QA_UNAVAILABLE", error: copy.unavailable },
      { status: 503, headers },
    );
  }
}
