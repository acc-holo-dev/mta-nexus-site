import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { parseDiscoverApiQuery } from "../../../features/discovery/discover-query";
import { discoveryCopy } from "../../../features/discovery/discovery-copy";
import { getTrustedRequestIp } from "../../../features/shell/request-client-ip";
import { resolveLocale } from "../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/platform/observability";
import { discoveryService } from "../../../lib/services/discovery/discovery-service";
export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = discoveryCopy(resolveLocale(request.cookies.get("nexus_locale")?.value));
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = parseDiscoverApiQuery(request.nextUrl.searchParams);
    if (!query)
      return jsonWithRequestId(
        context,
        { code: "VALIDATION_ERROR", error: copy.invalid },
        { status: 400, headers },
      );
    if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
      return jsonWithRequestId(
        context,
        { code: "RATE_LIMIT_EXCEEDED", error: copy.rate },
        { status: 429, headers },
      );
    return jsonWithRequestId(context, await discoveryService.page(query), {
      headers,
    });
  } catch (error) {
    logRequestEvent({ level: "error", event: "discover.page_failed", context, status: 503, error });
    return jsonWithRequestId(
      context,
      { code: "INTERNAL_ERROR", error: copy.unavailable },
      { status: 503, headers },
    );
  }
}
