import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { parseServerStatisticsQuery } from "./server-statistics-contract";
import { serverStatisticsCsv } from "./server-statistics-export";
import { serverStatisticsError } from "./server-statistics-copy";
import { serverStatisticsService } from "./services/server-statistics-service";
import { authService } from "./services/auth-service";
import { getTrustedRequestIp } from "./request-client-ip";
import { resolveLocale } from "./i18n";
import { createRequestLogContext, jsonWithRequestId, logRequestEvent } from "./observability";

export async function serverStatisticsHttp(
  request: NextRequest,
  id: string,
  managed: boolean,
  exporting = false,
) {
  const context = createRequestLogContext(request);
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const user = managed
      ? await authService.getSession(request.cookies.get("nexus_session")?.value)
      : null;
    if (managed && !user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id))
      throw new AppError("Server not found", 404, "NOT_FOUND");
    const query = parseServerStatisticsQuery(request.nextUrl.searchParams, exporting);
    if (!query) throw new AppError("Invalid statistics query", 400, "VALIDATION_ERROR");
    const rate = await consumeRateLimit(
      "search",
      user ? `server-statistics:${user.id}` : `server-statistics:${getTrustedRequestIp(request)}`,
    );
    if (!rate.success) throw new AppError("Rate limited", 429, "RATE_LIMITED");
    const report = await serverStatisticsService.read(
      { id },
      user ? { kind: "managed", actorId: user.id } : { kind: "public" },
      query,
    );
    if (!report) throw new AppError("Server not found", 404, "NOT_FOUND");
    if (!exporting) return jsonWithRequestId(context, report, { headers });
    const format = query.format ?? "buckets";
    return new Response(serverStatisticsCsv(report, format), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mta-server-statistics-${query.window}-${format}.csv"`,
        "x-request-id": context.requestId,
      },
    });
  } catch (error) {
    const known = error instanceof AppError;
    const status = known ? error.statusCode : 503,
      code = known ? error.code : "INTERNAL_ERROR";
    if (!known)
      logRequestEvent({
        level: "error",
        event: "server.statistics_read_failed",
        context,
        status,
        error,
      });
    return jsonWithRequestId(
      context,
      {
        code,
        error: serverStatisticsError(
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
