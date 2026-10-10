import { describe, expect, it } from "vitest";
import { isValidMtaAddress, normalizeMtaAddress } from "@nexus/domain";
import { createServerSchema, updateServerSchema } from "@nexus/validation";
import { matchesMtaEndpoint } from "../apps/web/src/lib/services/mta-master-directory-service";

describe("MTA address canonicalization across directory, forms and persistence", () => {
  it.each([
    ["  PLAY.Example.COM.  ", "play.example.com"],
    ["198.51.100.7", "198.51.100.7"],
    ["[2001:DB8::1]", "[2001:db8::1]"],
    ["fe80::ABCD", "fe80::abcd"],
    ["local-mta", "local-mta"],
  ])("normalizes %s into %s idempotently", (input, expected) => {
    expect(normalizeMtaAddress(input)).toBe(expected);
    expect(normalizeMtaAddress(expected)).toBe(expected);
    expect(isValidMtaAddress(expected)).toBe(true);
  });

  it("canonicalizes both registration and partial edits", () => {
    expect(createServerSchema.parse({
      name: "MTA Racing",
      slug: "mta-racing",
      ipAddress: "  PLAY.Example.COM.  ",
    }).ipAddress).toBe("play.example.com");
    expect(updateServerSchema.parse({ ipAddress: " PLAY.Example.COM. " }))
      .toEqual({ ipAddress: "play.example.com" });
    expect(matchesMtaEndpoint(
      { ipAddress: " PLAY.Example.COM. ", port: 22003 },
      { address: "play.example.com", port: 22003 },
    )).toBe(true);
    expect(matchesMtaEndpoint(
      { ipAddress: "[2001:DB8::1]", port: 22003 },
      { address: "[2001:db8::1]", port: 22004 },
    )).toBe(false);
  });

  it.each([
    "",
    " ",
    ".",
    "..",
    "bad..com",
    "host.example:22003",
    "http://example.com",
    "user@example.com",
    "host\\path",
    "bad\nhost",
    "a".repeat(256),
  ])("refuses invalid or ambiguous host %j", (value) => {
    expect(isValidMtaAddress(normalizeMtaAddress(value))).toBe(false);
    expect(createServerSchema.safeParse({
      name: "MTA Racing",
      slug: "mta-racing",
      ipAddress: value,
    }).success).toBe(false);
    expect(updateServerSchema.safeParse({ ipAddress: value }).success).toBe(false);
  });
});
