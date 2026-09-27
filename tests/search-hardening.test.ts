import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public search hardening", () => {
  it("validates, rate-limits and bounds public search responses", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/search/route.ts"),
      "utf8"
    );

    expect(route).toContain('consumeRateLimit("search", getTrustedRequestIp(request))');
    expect(route).not.toContain("getClientIp(request.headers)");
    expect(route).toContain("MAX_QUERY_LENGTH");
    expect(route).toContain("SEARCH_TYPES");
    expect(route).toContain("Unknown search type");
    expect(route).toContain("Math.min(Math.max(Math.floor(requestedLimit), 1), DEFAULT_LIMIT)");
    expect(route).toContain("stale-while-revalidate=60");
  });

  it("bounds every discovery source and the final result set", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/discovery-service.ts"),
      "utf8"
    );

    expect(service).toContain("productRepository.list({ query: normalizedQuery, limit: boundedLimit })");
    expect(service).toContain("serverRepository.searchActivePublic(normalizedQuery, boundedLimit)");
    expect(service).toContain("contentRepository.searchPublished(normalizedQuery, boundedLimit)");
    expect(service).toContain("userRepository.searchDevelopers(normalizedQuery, boundedLimit)");
    expect(service).toContain("organizationRepository.searchPublic(normalizedQuery, boundedLimit)");
    expect(service).toContain("mtaMasterDirectoryService.getDirectory()");
    expect(service).toContain("if (!directory.isStale)");
    expect(service).toContain("if (results.length === boundedLimit) break;");
    expect(service).not.toContain("currentPlayers");
    expect(service).toContain("return results");
  });
});
