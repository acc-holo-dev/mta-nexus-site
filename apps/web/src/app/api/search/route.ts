import type { NextRequest } from "next/server";
import { consumeRateLimit } from "@nexus/security";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/observability";
import { getTrustedRequestIp } from "../../../lib/request-client-ip";
import {
  discoveryService,
  type SearchResultType,
} from "../../../lib/services/discovery-service";

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
  "Cache-Control":
    "public, max-age=15, stale-while-revalidate=60",
};

const errorHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);

  try {
    const query = (
      request.nextUrl.searchParams.get("q") ||
      ""
    ).trim();

    if (query.length > MAX_QUERY_LENGTH) {
      return jsonWithRequestId(
        context,
        {
          error:
            `Search query must be at most ${MAX_QUERY_LENGTH} characters`,
        },
        {
          status: 400,
          headers: errorHeaders,
        },
      );
    }

    const requestedLimit = Number(
      request.nextUrl.searchParams.get("limit") ||
        DEFAULT_LIMIT,
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(
          Math.max(
            Math.floor(requestedLimit),
            1,
          ),
          DEFAULT_LIMIT,
        )
      : DEFAULT_LIMIT;

    const requestedType =
      request.nextUrl.searchParams.get("type");
    if (
      requestedType &&
      !SEARCH_TYPES.has(
        requestedType as SearchResultType,
      )
    ) {
      return jsonWithRequestId(
        context,
        { error: "Unknown search type" },
        {
          status: 400,
          headers: errorHeaders,
        },
      );
    }

    const type =
      requestedType as SearchResultType | null;

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

    const rateLimit = await consumeRateLimit(
      "search",
      getTrustedRequestIp(request),
    );
    if (!rateLimit.success) {
      return jsonWithRequestId(
        context,
        {
          error:
            "Search rate limit exceeded. Please try again shortly.",
        },
        {
          status: 429,
          headers: errorHeaders,
        },
      );
    }

    const results =
      await discoveryService.search(
        query,
        limit,
        type || undefined,
      );

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
    return jsonWithRequestId(
      context,
      {
        error:
          "Search is temporarily unavailable",
      },
      {
        status: 503,
        headers: errorHeaders,
      },
    );
  }
}
