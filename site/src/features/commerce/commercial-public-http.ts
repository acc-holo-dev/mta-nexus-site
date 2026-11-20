import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { resolveLocale } from "../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../lib/platform/observability";
import { getTrustedRequestIp } from "../shell/request-client-ip";
import { commercialError } from "./commercial-i18n";

export async function commercialPublicRequest(
  request: NextRequest,
  operation: () => Promise<unknown>,
) {
  const context = createRequestLogContext(request);
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  const codeBody = (code: string) => ({ code, error: commercialError(locale, code) });
  try {
    if (!(await consumeRateLimit("resourceInspection", getTrustedRequestIp(request))).success)
      throw new RateLimitExceededError();
    return respond(await operation());
  } catch (error) {
    if (error instanceof AppError) return respond(codeBody(error.code), error.statusCode);
    logRequestEvent({
      level: "error",
      event: "commercial.catalog_failed",
      context,
      status: 500,
      error,
    });
    return respond(codeBody("COMMERCIAL_PLAN_FAILED"), 500);
  }
}
