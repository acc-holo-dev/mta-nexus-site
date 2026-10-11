import type { NextRequest } from "next/server";
import { AppError, UnauthorizedError, RateLimitExceededError, type User } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { authService } from "./services/auth-service";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";
import { requireServerJsonContentType } from "./bounded-json";

export async function resourceCommerceRequest(
  request: NextRequest,
  mutation: boolean,
  operation: (actor: User) => Promise<unknown>,
) {
  const context = createRequestLogContext(request);
  const respond = (body: unknown, status = 200) =>
    jsonWithRequestId(context, body, {
      status,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  try {
    const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!actor) throw new UnauthorizedError();
    if (mutation) {
      requireServerJsonContentType(request);
      if (request.headers.get("sec-fetch-site") === "cross-site") {
        throw new AppError("Cross-site mutation is forbidden", 403, "FORBIDDEN");
      }
      const policy =
        /^\/api\/library\/collections(?:\/|$)/u.test(request.nextUrl.pathname)
          ? "contentCreation"
          : request.nextUrl.pathname.startsWith("/api/admin/resources/") ||
        request.nextUrl.pathname.startsWith("/api/admin/commerce/") ||
        request.nextUrl.pathname.startsWith("/api/admin/licenses/") ||
        request.nextUrl.pathname.startsWith("/api/admin/storage/")
          ? "moderationAction"
          : /^\/api\/subscriptions\/account(?:\/|$)/u.test(request.nextUrl.pathname)
            ? "contentCreation"
          : /\/orders\/[^/]+\/support$/u.test(request.nextUrl.pathname)
            ? "contentCreation"
            : /\/(reviews|review)(?:\/|$)/u.test(request.nextUrl.pathname)
              ? "reviewSubmission"
              : request.nextUrl.pathname.includes("/licenses/")
                ? "licenseControl"
                : /\/(lifecycle|variants|compatibility|builds|media|copy)(?:\/|$)/u.test(
                      request.nextUrl.pathname,
                    )
                  ? "contentCreation"
                  : "resourceClaim";
      if (!(await consumeRateLimit(policy, actor.id)).success) throw new RateLimitExceededError();
    }
    if (
      !mutation &&
      (/^\/api\/library\/collections(?:\/|$)/u.test(request.nextUrl.pathname) || /^\/api\/subscriptions\/account(?:\/|$)/u.test(request.nextUrl.pathname) || /\/products\/[^/]+\/(?:copy|copies)(?:\/|$)/u.test(request.nextUrl.pathname) || /^\/api\/subscriptions\/reviews(?:\/|$)/u.test(request.nextUrl.pathname) || /\/orders\/[^/]+\/terms(?:\/|$)/u.test(request.nextUrl.pathname) || /^\/api\/sales(?:\/|$)/u.test(request.nextUrl.pathname) || /\/requirements(?:\/|$)/u.test(request.nextUrl.pathname) || /\/activity(?:\/|$)|^\/api\/finance(?:\/|$)|^\/api\/acquisitions$|^\/api\/resources\/cart\/(?:review|receipts)(?:\/|$)|^\/api\/admin\/storage(?:\/|$)|^\/api\/admin\/commerce\/|^\/api\/orders\/[^/]+\/(?:operations|support)$|^\/api\/licenses\/[^/]+\/runtime-config$|^\/api\/licenses(?:$|\/export$)|^\/api\/workspace\/resources$|^\/api\/products\/[^/]+\/history$|^\/api\/admin\/licenses\/maintenance$|^\/api\/order-cases(?:\/|$)|^\/api\/admin\/resources(?:\/|$)|^\/api\/library\/(?:watches|downloads|releases|reviews|review)(?:\/|$)|^\/api\/review-reports(?:\/|$)|^\/api\/products\/[^/]+\/(?:media|moderation|deliveries|builds\/[^/]+(?:\/package(?:\/files)?)?)$/u.test(
        request.nextUrl.pathname,
      ))
    ) {
      if (!(await consumeRateLimit("resourceInspection", actor.id)).success)
        throw new RateLimitExceededError();
    }
    const result = await operation(actor);
    if (result instanceof Response) {
      result.headers.set("Cache-Control", "private, no-store");
      result.headers.set("Vary", "Cookie");
      result.headers.set("X-Request-Id", context.requestId);
      return result;
    }
    return respond(result);
  } catch (error) {
    if (error instanceof AppError) return respond({ code: error.code }, error.statusCode);
    logRequestEvent({
      level: "error",
      event: "resource.commerce_failed",
      context,
      status: 500,
      error,
    });
    return respond({ code: "RESOURCE_COMMERCE_FAILED" }, 500);
  }
}
