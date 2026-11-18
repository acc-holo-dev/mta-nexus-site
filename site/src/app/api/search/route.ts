import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { discoverySearchApiCopy } from "../../../features/discovery/discovery-search-api-copy";
import { getTrustedRequestIp } from "../../../features/shell/request-client-ip";
import { resolveLocale } from "../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/platform/observability";
import {
  discoveryService,
  type SearchResultType,
} from "../../../lib/services/discovery/discovery-service";

const MAX_QUERY_LENGTH = 100;
const DEFAULT_LIMIT = 50;

const SEARCH_TYPES = new Set<SearchResultType>([
  "product",
  "server",
  "developer",
  "organization",
  "article",
]);

const publicHeaders = {
  "Cache-Control": "no-store",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const locale = resolveLocale(request.cookies.get("nexus_locale")?.value);
  const copy = discoverySearchApiCopy(locale);

  try {
    const query = (request.nextUrl.searchParams.get("q") || "").trim();

    if (query.length > MAX_QUERY_LENGTH) {
      return jsonWithRequestId(
        context,
        {
          error: copy.queryTooLong(MAX_QUERY_LENGTH),
        },
        {
          status: 400,
          headers: errorHeaders,
        },
      );
    }

    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), DEFAULT_LIMIT)
      : DEFAULT_LIMIT;

    const requestedType = request.nextUrl.searchParams.get("type");
    if (requestedType && !SEARCH_TYPES.has(requestedType as SearchResultType)) {
      return jsonWithRequestId(
        context,
        { error: copy.unknownType },
        {
          status: 400,
          headers: errorHeaders,
        },
      );
    }

    const type = requestedType as SearchResultType | null;

    if (query.length === 0) {
      return Response.json(
        {
          query,
          type,
          count: 0,
          results: [],
          limit,
        },
        { headers: publicHeaders },
      );
    }

    const rateLimit = await consumeRateLimit("search", getTrustedRequestIp(request));
    if (!rateLimit.success) {
      // Failure state: never return an empty results payload that looks like "no matches".
      return jsonWithRequestId(
        context,
        {
          error: copy.rate,
          unavailable: true,
        },
        {
          status: 429,
          headers: errorHeaders,
        },
      );
    }

    const results = await discoveryService.search(query, limit, type || undefined, locale);

    return Response.json(
      {
        query,
        type,
        count: results.length,
        results,
        limit,
      },
      { headers: publicHeaders },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "search.failed",
      context,
      status: 503,
      error,
    });
    // Failure state: clients must not treat this as an empty successful search.
    return jsonWithRequestId(
      context,
      {
        error: copy.unavailable,
        unavailable: true,
      },
      {
        status: 503,
        headers: errorHeaders,
      },
    );
  }
}
