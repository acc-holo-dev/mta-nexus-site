import { describe, expect, it } from "vitest";
import { parseProfilePage } from "../../src/features/accounts/profile-pagination";

describe("parseProfilePage", () => {
  it("defaults invalid or missing values to page 1", () => {
    expect(parseProfilePage(undefined)).toBe(1);
    expect(parseProfilePage("")).toBe(1);
    expect(parseProfilePage("0")).toBe(1);
    expect(parseProfilePage("-1")).toBe(1);
    expect(parseProfilePage("01")).toBe(1);
    expect(parseProfilePage("1.5")).toBe(1);
    expect(parseProfilePage("abc")).toBe(1);
    expect(parseProfilePage(["2"])).toBe(1);
  });

  it("accepts positive integer page strings up to 9 digits", () => {
    expect(parseProfilePage("1")).toBe(1);
    expect(parseProfilePage("2")).toBe(2);
    expect(parseProfilePage("999999999")).toBe(999999999);
  });

  it("rejects 10+ digit page strings", () => {
    expect(parseProfilePage("1000000000")).toBe(1);
  });
});
