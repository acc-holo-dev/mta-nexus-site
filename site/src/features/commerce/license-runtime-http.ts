import { AppError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit, digestLicenseRuntimeToken } from "@nexus/security";
import type { NextRequest } from "next/server";
import { requireServerJsonContentType } from "../../lib/http/bounded-json";
import { resolveLocale } from "../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../lib/platform/observability";
import { getTrustedRequestIp } from "../shell/request-client-ip";
import { licenseControlError } from "./license-control-i18n";

/** Shared bearer-only runtime boundary; cookies never replace a runtime token. */
export async function licenseRuntimeRequest(
  request: NextRequest,
  operation: (digest: string) => Promise<unknown | null>,
) {
  const context = createRequestLogContext(request);
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  const denied = (code: string, status: number) =>
    respond({ valid: false, code, error: licenseControlError(locale, code) }, status);
  try {
    requireServerJsonContentType(request);
    const authorization = request.headers.get("authorization"),
      token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const digest = digestLicenseRuntimeToken(token);
    if (!digest) throw new UnauthorizedError();
    const ip = getTrustedRequestIp(request);
    if (
      !(await consumeRateLimit("licenseCheck", `token:${digest}`)).success ||
      (ip !== "unknown" && !(await consumeRateLimit("licenseCheck", `ip:${ip}`)).success)
    )
      throw new RateLimitExceededError();
    const result = await operation(digest);
    return result ? respond(result) : denied("LICENSE_CHECK_DENIED", 401);
  } catch (error) {
    if (error instanceof AppError) return denied(error.code, error.statusCode);
    logRequestEvent({ level: "error", event: "license.check_failed", context, status: 500, error });
    return denied("LICENSE_CHECK_FAILED", 500);
  }
}
