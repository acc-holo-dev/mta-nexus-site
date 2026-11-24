import { describe, expect, it } from "vitest";
import {
  mtaDirectoryHref,
  parseMtaDirectoryApiQuery,
  parseMtaDirectoryPageQuery,
} from "../../src/features/servers/mta-directory-page-query";

describe("MTA directory page query", () => {
  it("defaults to the first page without filters", () => {
    expect(parseMtaDirectoryPageQuery({})).toEqual({
      query: "",
      minPlayers: 0,
      page: 1,
    });
    expect(mtaDirectoryHref({ query: "", minPlayers: 0, page: 1 })).toBe("/servers");
  });

  it("round-trips search, minimum players and pagination for Back/refresh", () => {
    const state = parseMtaDirectoryPageQuery({
      q: "  drift  ",
      minPlayers: "50",
      page: "3",
    });
    expect(state).toEqual({ query: "drift", minPlayers: 50, page: 3 });
    expect(mtaDirectoryHref(state)).toBe("/servers?q=drift&minPlayers=50&page=3");
    expect(parseMtaDirectoryApiQuery(new URLSearchParams("q=drift&minPlayers=50&page=3"))).toEqual(
      state,
    );
  });

  it("rejects malformed API queries and clamps invalid thresholds", () => {
    expect(parseMtaDirectoryApiQuery(new URLSearchParams("minPlayers=999"))).toBeNull();
    expect(parseMtaDirectoryPageQuery({ minPlayers: "999" }).minPlayers).toBe(0);
    expect(parseMtaDirectoryApiQuery(new URLSearchParams("page=0"))).toBeNull();
    expect(parseMtaDirectoryPageQuery({ q: "x".repeat(120) }).query).toHaveLength(100);
  });
});
