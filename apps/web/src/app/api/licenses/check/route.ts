import type { NextRequest } from "next/server";
import { licenseControlsRepository } from "@nexus/db";
import { AppError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit, digestLicenseRuntimeToken } from "@nexus/security";
import { licenseRuntimeCheckSchema } from "@nexus/validation";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";
import { getTrustedRequestIp } from "../../../../lib/request-client-ip";

export async function POST(request: NextRequest) {
  const context = createRequestLogContext(request);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  try {
    requireServerJsonContentType(request);
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const digest = digestLicenseRuntimeToken(token);
    if (!digest) throw new UnauthorizedError();
    // Raw bearer credentials never become log fields or limiter keys. In a
    // trusted proxy environment, also cap requests by the verified client IP.
    const ip = getTrustedRequestIp(request);
    if (
      !(await consumeRateLimit("licenseCheck", `token:${digest}`)).success ||
      (ip !== "unknown" && !(await consumeRateLimit("licenseCheck", `ip:${ip}`)).success)
    )
      throw new RateLimitExceededError();
    const parsed = licenseRuntimeCheckSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) throw new AppError("Invalid license check", 422, "VALIDATION_FAILED");
    const result = await licenseControlsRepository.verify(digest, parsed.data.serverId);
    if (!result) return respond({ valid: false, code: "LICENSE_CHECK_DENIED" }, 401);
    return respond(result);
  } catch (error) {
    if (error instanceof AppError)
      return respond({ valid: false, code: error.code }, error.statusCode);
    logRequestEvent({ level: "error", event: "license.check_failed", context, status: 500, error });
    return respond({ valid: false, code: "LICENSE_CHECK_FAILED" }, 500);
  }
}
