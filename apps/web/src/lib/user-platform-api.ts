import type { NextRequest } from "next/server";
import { AppError, UnauthorizedError } from "@nexus/domain";
import type { User } from "@nexus/domain";
import { authService } from "./services/auth-service";
import { resolveLocale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";

export async function userPlatformApi(
  request: NextRequest,
  action: (user: User) => Promise<unknown>,
  status = 200,
) {
  const context = createRequestLogContext(request);
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!user) throw new UnauthorizedError();
    if (request.method !== "GET" && request.headers.get("sec-fetch-site") === "cross-site") {
      throw new AppError("Cross-site mutation is forbidden", 403, "FORBIDDEN");
    }
    return jsonWithRequestId(context, await action(user), { status, headers });
  } catch (error) {
    const known = error instanceof AppError;
    const code = known ? error.code : "INTERNAL_ERROR";
    const statusCode = known ? error.statusCode : 503;
    if (!known)
      logRequestEvent({
        level: "error",
        event: "user_platform.request_failed",
        context,
        status: statusCode,
        error,
      });
    return jsonWithRequestId(
      context,
      {
        error: userPlatformError(resolveLocale(request.cookies.get("nexus_locale")?.value), code),
        code,
      },
      { status: statusCode, headers },
    );
  }
}
