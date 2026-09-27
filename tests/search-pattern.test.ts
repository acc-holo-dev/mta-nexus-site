import { describe, expect, it } from "vitest";
import { containsPattern } from "../packages/db/src/repositories/search-pattern";

describe("literal search input", () => {
  it("escapes PostgreSQL wildcard characters while preserving ordinary terms", () => {
    expect(containsPattern("hello")).toBe("%hello%");
    expect(containsPattern(String.raw`50%_off\sale`)).toBe(String.raw`%50\%\_off\\sale%`);
  });
});
