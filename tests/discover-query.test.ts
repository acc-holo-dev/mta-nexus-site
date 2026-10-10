import { describe, expect, it } from "vitest";
import {
  DISCOVER_TYPES,
  discoverHref,
  parseDiscoverQuery,
} from "../apps/web/src/lib/discover-query";

describe("discover query contract", () => {
  it("defaults to servers and keeps entity families explicit", () => {
    expect(DISCOVER_TYPES).toEqual([
      "servers",
      "resources",
      "creators",
      "organizations",
      "content",
    ]);
    expect(parseDiscoverQuery({})).toMatchObject({ type: "servers", query: "", page: 1 });
    expect(parseDiscoverQuery({ type: "unknown" })).toMatchObject({
      type: "servers",
      query: "",
    });
  });

  it("normalizes query values and bounds user input", () => {
    expect(parseDiscoverQuery({ type: ["content", "servers"], q: ["  lua  ", "ignored"] }))
      .toMatchObject({ type: "content", query: "lua" });
    expect(parseDiscoverQuery({ type: "resources", q: "x".repeat(150) }).query)
      .toHaveLength(100);
  });

  it("builds canonical links without mixed-result state", () => {
    expect(discoverHref({ type: "organizations" }))
      .toBe("/discover?type=organizations");
    expect(discoverHref({ type: "creators", query: "  nexus team  " }))
      .toBe("/discover?type=creators&q=nexus+team");
  });
});
