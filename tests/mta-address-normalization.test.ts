import { describe, expect, it } from "vitest";
import { isValidMtaAddress, normalizeMtaAddress } from "@nexus/domain";
import { createServerSchema, updateServerSchema } from "@nexus/validation";
import { matchesMtaEndpoint } from "../apps/web/src/lib/services/mta-master-directory-service";

describe("MTA address canonicalization across directory, forms and persistence", () => {
  it.each([
    ["  PLAY.Example.COM.  ", "play.example.com"],
    ["198.51.100.7", "198.51.100.7"],
    ["[2001:DB8::1]", "[2001:db8::1]"],
    ["fe80::ABCD", "[fe80::abcd]"],
    ["local-mta", "local-mta"],
    ["127.1", "127.0.0.1"],
    ["2001:0DB8:0000:0000:0000:0000:0000:0001", "[2001:db8::1]"],
    ["bücher.de", "xn--bcher-kva.de"],
    ["::ffff:192.0.2.1", "[::ffff:c000:201]"],
    ["example.com.", "example.com"],
  ])("normalizes %s into %s idempotently", (input, expected) => {
    expect(normalizeMtaAddress(input)).toBe(expected);
    expect(normalizeMtaAddress(expected)).toBe(expected);
    expect(isValidMtaAddress(expected)).toBe(true);
  });

  it("treats raw and bracketed IPv6 as one server endpoint", () => {
    const raw = normalizeMtaAddress("fe80::ABCD");
    const bracketed = normalizeMtaAddress("[fe80::abcd]");
    const expanded = normalizeMtaAddress("fe80:0:0:0:0:0:0:abcd");
    expect(raw).toBe("[fe80::abcd]");
    expect(raw).toBe(bracketed);
    expect(raw).toBe(expanded);
    expect(isValidMtaAddress(raw)).toBe(true);
  });

  it("canonicalizes both registration and partial edits", () => {
    expect(
      createServerSchema.parse({
        name: "MTA Racing",
        slug: "mta-racing",
        ipAddress: "  PLAY.Example.COM.  ",
      }).ipAddress,
    ).toBe("play.example.com");
    expect(updateServerSchema.parse({ ipAddress: " PLAY.Example.COM. " })).toEqual({
      ipAddress: "play.example.com",
    });
    expect(
      matchesMtaEndpoint(
        { ipAddress: " PLAY.Example.COM. ", port: 22003 },
        { address: "play.example.com", port: 22003 },
      ),
    ).toBe(true);
    expect(
      matchesMtaEndpoint(
        { ipAddress: "[2001:DB8::1]", port: 22003 },
        { address: "[2001:db8::1]", port: 22004 },
      ),
    ).toBe(false);
  });

  it.each([
    "",
    " ",
    ".",
    "..",
    "bad..com",
    "play.example..",
    "127.0.0.999",
    "2001:::zzzz",
    "fe80::abcd.",
    "[fe80::abcd].",
    "::1.",
    "[::1].",
    "[::1]:22003",
    "bad_name.example",
    "host.example:22003",
    "http://example.com",
    "user@example.com",
    "host\\path",
    "bad\nhost",
    "a".repeat(256),
  ])("refuses invalid or ambiguous host %j", (value) => {
    expect(isValidMtaAddress(normalizeMtaAddress(value))).toBe(false);
    expect(
      createServerSchema.safeParse({
        name: "MTA Racing",
        slug: "mta-racing",
        ipAddress: value,
      }).success,
    ).toBe(false);
    expect(updateServerSchema.safeParse({ ipAddress: value }).success).toBe(false);
  });
});
