import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { authService } from "./services/auth-service";
import { serverStatisticsService } from "./services/server-statistics-service";
import { parseServerObservationBrowserQuery } from "./server-observation-browser-contract";
import { serverObservationBrowserCsv } from "./server-statistics-export";
import { serverObservationBrowserError } from "./server-observation-browser-copy";
import { getTrustedRequestIp } from "./request-client-ip";
import { resolveLocale } from "./i18n";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";
export async function serverObservationBrowserHttp(
  request: NextRequest,
  id: string,
  managed: boolean,
  exporting = false,
) {
  const context = createRequestLogContext(request),
    headers = {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    };
  try {
    const actor = managed
      ? await authService.getSession(request.cookies.get("nexus_session")?.value)
      : null;
    if (managed && !actor) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id))
      throw new AppError("Server unavailable", 404, "NOT_FOUND");
    const query = parseServerObservationBrowserQuery(request.nextUrl.searchParams);
    if (!query) throw new AppError("Invalid observation filters", 400, "VALIDATION_ERROR");
    if (
      !(
        await consumeRateLimit(
          "search",
          `server-observations:${actor?.id ?? getTrustedRequestIp(request)}`,
        )
      ).success
    )
      throw new RateLimitExceededError();
    const report = await serverStatisticsService.observations(
      { id },
      actor ? { kind: "managed", actorId: actor.id } : { kind: "public" },
      query,
    );
    if (!report) throw new AppError("Server unavailable", 404, "NOT_FOUND");
    if (!exporting) return jsonWithRequestId(context, report, { headers });
    return new Response(serverObservationBrowserCsv(report), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mta-server-observations-${query.window}.csv"`,
        "x-request-id": context.requestId,
      },
    });
  } catch (error) {
    const known = error instanceof AppError,
      status = known ? error.statusCode : 503,
      code = known ? error.code : "INTERNAL_ERROR";
    if (!known)
      logRequestEvent({
        level: "error",
        event: "server.observation_browser_failed",
        context,
        status,
        error,
      });
    return jsonWithRequestId(
      context,
      {
        code,
        error: serverObservationBrowserError(
          resolveLocale(request.cookies.get("nexus_locale")?.value),
          code,
        ),
      },
      {
        status,
        headers: {
          ...headers,
          ...(status === 429 || status === 503 ? { "Retry-After": "30" } : {}),
        },
      },
    );
  }
}
