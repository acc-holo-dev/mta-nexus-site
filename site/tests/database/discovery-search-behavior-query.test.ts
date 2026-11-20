import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  discoverHref,
  parseDiscoverApiQuery,
  parseDiscoverQuery,
} from "../../src/features/discovery/discover-query";
import {
  setupDiscoverySearchBehavior,
  sources,
} from "../helpers/discovery-search-behavior-harness";

vi.mock("@nexus/db", async () => {
  const { sources: harnessSources } = await import("../helpers/discovery-search-behavior-harness");
  return {
    productRepository: { list: harnessSources.products },
    serverRepository: { searchActivePublic: harnessSources.servers },
    contentRepository: { searchPublished: harnessSources.articles },
    userRepository: { searchDevelopers: harnessSources.developers },
    organizationRepository: { searchPublic: harnessSources.organizations },
  };
});
vi.mock("@nexus/security", async () => {
  const { sources: harnessSources } = await import("../helpers/discovery-search-behavior-harness");
  return {
    consumeRateLimit: (...args: unknown[]) => harnessSources.rateLimit(...args),
  };
});
vi.mock("../../src/lib/services/servers/mta-master-directory-service", async (importOriginal) => {
  const { sources: harnessSources } = await import("../helpers/discovery-search-behavior-harness");
  return {
    ...(await importOriginal<
      typeof import("../../src/lib/services/servers/mta-master-directory-service")
    >()),
    mtaMasterDirectoryService: { getDirectory: harnessSources.directory },
  };
});

import { GET as searchGet } from "../../src/app/api/search/route";
import { discoverySearchApiCopy } from "../../src/features/discovery/discovery-search-api-copy";

setupDiscoverySearchBehavior();

function searchRequest(path: string, locale = "en") {
  return new NextRequest(`https://nexus.test${path}`, {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

describe("discovery URL context and honest search failures", () => {
  it("round-trips query, type and filters so Back/refresh can restore the same search", () => {
    const state = parseDiscoverQuery({
      type: "servers",
      q: "role play",
      page: "3",
      verified: "1",
      sort: "name",
      language: "ru",
      region: "EU",
      gameMode: "RP",
    });
    const href = discoverHref(state);
    const restored = parseDiscoverApiQuery(new URL(href, "https://nexus.test").searchParams);
    expect(restored).toEqual(state);
    expect(discoverHref({ ...state, language: "en", page: 1 })).not.toContain("page=");
  });

  it("clears incompatible filters when the discover type changes", () => {
    const next = parseDiscoverQuery({
      type: "resources",
      q: "car",
      page: "4",
      verified: "1",
      language: "ru",
      contentType: "news",
    });
    expect(next).toMatchObject({
      type: "resources",
      query: "car",
      page: 4,
      verified: false,
      language: "",
      contentType: "",
    });
    expect(discoverHref({ type: "resources", query: "car" })).toBe(
      "/discover?type=resources&q=car",
    );
    expect(
      discoverHref({
        type: "content",
        query: "car",
        page: 1,
        language: "ru",
        verified: true,
        contentType: "news",
      }),
    ).toBe("/discover?type=content&q=car&contentType=news");
  });

  it("returns 429 without an empty results payload", async () => {
    sources.rateLimit.mockResolvedValueOnce({ success: false });
    const response = await searchGet(searchRequest("/api/search?q=nexus&type=server"));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.unavailable).toBe(true);
    expect(body.results).toBeUndefined();
    expect(body.error).toBe(discoverySearchApiCopy("en").rate);
    expect(sources.servers).not.toHaveBeenCalled();
  });

  it("returns bilingual 429 / 400 / 503 search errors from nexus_locale", async () => {
    sources.rateLimit.mockResolvedValueOnce({ success: false });
    const rateRu = await searchGet(searchRequest("/api/search?q=nexus", "ru"));
    expect(rateRu.status).toBe(429);
    expect(await rateRu.json()).toMatchObject({
      unavailable: true,
      error: discoverySearchApiCopy("ru").rate,
    });

    const typeRu = await searchGet(searchRequest("/api/search?q=nexus&type=bogus", "ru"));
    expect(typeRu.status).toBe(400);
    expect(await typeRu.json()).toMatchObject({
      error: discoverySearchApiCopy("ru").unknownType,
    });

    sources.products.mockRejectedValueOnce(new Error("catalog offline"));
    const downRu = await searchGet(searchRequest("/api/search?q=nexus", "ru"));
    expect(downRu.status).toBe(503);
    expect(await downRu.json()).toMatchObject({
      unavailable: true,
      error: discoverySearchApiCopy("ru").unavailable,
    });
  });

  it("returns 503 without an empty results payload when search fails", async () => {
    sources.products.mockRejectedValueOnce(new Error("catalog offline"));
    const response = await searchGet(searchRequest("/api/search?q=nexus"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.unavailable).toBe(true);
    expect(body.results).toBeUndefined();
    expect(body.error).toBe(discoverySearchApiCopy("en").unavailable);
  });

  it("keeps a successful empty search distinct from failure statuses", async () => {
    const response = await searchGet(searchRequest("/api/search?q=missing"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      query: "missing",
      count: 0,
      results: [],
    });
  });
});
