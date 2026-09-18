import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, getClientIp } from "@nexus/security";
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

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim();

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Search query must be at most ${MAX_QUERY_LENGTH} characters` },
      { status: 400 }
    );
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), DEFAULT_LIMIT)
    : DEFAULT_LIMIT;
  const requestedType = request.nextUrl.searchParams.get("type");
  if (requestedType && !SEARCH_TYPES.has(requestedType as SearchResultType)) {
    return NextResponse.json(
      { error: "Unknown search type" },
      { status: 400 }
    );
  }
  const type = requestedType as SearchResultType | null;

  if (query.length === 0) {
    return NextResponse.json(
      { query, type, count: 0, results: [], limit },
      { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } }
    );
  }

  const rateLimit = await consumeRateLimit("search", getClientIp(request.headers));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Search rate limit exceeded. Please try again shortly." },
      { status: 429 }
    );
  }

  const results = await discoveryService.search(query, limit, type || undefined);
  return NextResponse.json(
    { query, type, count: results.length, results, limit },
    { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } }
  );
}
