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
      const policy = request.nextUrl.pathname.startsWith("/api/admin/licenses/")
        ? "moderationAction"
        : request.nextUrl.pathname.includes("/licenses/")
        ? "licenseControl"
        : request.nextUrl.pathname.includes("/lifecycle")
        ? "contentCreation"
        : "resourceClaim";
      if (!(await consumeRateLimit(policy, actor.id)).success) throw new RateLimitExceededError();
    }
    return respond(await operation(actor));
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
