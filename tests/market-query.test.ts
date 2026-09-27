import { describe, expect, it } from "vitest";
import { MARKET_PAGE_SIZE, marketHref, parseMarketPage, parseMarketQuery } from "../apps/web/src/lib/market-query";

describe("free resource catalog navigation", () => {
  it("accepts every visible category, including API resources", () => {
    expect(parseMarketQuery({ type: "api", sort: "newest", page: "5", q: "  MTA script  " }))
      .toEqual({ type: "api", sort: "newest", page: 5, query: "MTA script" });
    expect(parseMarketQuery({ type: "service", sort: "rating" }).type).toBe("service");
  });

  it("ignores invalid, repeated or oversized parameters before querying", () => {
    const filters = parseMarketQuery({
      type: "private",
      sort: ["rating", "newest"],
      q: ["bad", "input"],
      page: "999999999999999999999",
    });
    expect(filters).toEqual({ type: "all", sort: "popular", query: "", page: 1 });
    expect(parseMarketPage("0")).toBe(1);
    expect(parseMarketPage("-2")).toBe(1);
    expect(parseMarketPage("1.5")).toBe(1);
    expect(parseMarketPage("1001")).toBe(1);
    expect(parseMarketQuery({ q: "x".repeat(200) }).query).toHaveLength(100);
  });

  it("preserves encoded search and filters while changing pages", () => {
    const url = marketHref({ type: "script", sort: "rating", query: "100%_ MTA", page: 4 });
    const parsed = new URL(url, "https://nexus.test");
    expect(parsed.pathname).toBe("/market");
    expect(parsed.searchParams.get("q")).toBe("100%_ MTA");
    expect(parsed.searchParams.get("page")).toBe("4");
    expect(parsed.searchParams.get("sort")).toBe("rating");
    expect(marketHref({ type: "all", sort: "popular", query: "", page: 1 }))
      .not.toContain("page=");
    expect(MARKET_PAGE_SIZE).toBeLessThan(100);
  });
});
