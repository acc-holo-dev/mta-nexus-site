import { isValidMtaAddress, normalizeMtaAddress } from "@nexus/domain";
import { describe, expect, it } from "vitest";

describe("AUD-05 IPv4-mapped MTA server identity", () => {
  it.each([
    ["10.0.0.1", "::ffff:10.0.0.1"],
    ["10.0.0.1", "[::ffff:a00:1]"],
    ["10.0.0.1", "0:0:0:0:0:FFFF:0A00:0001"],
    ["127.0.0.1", "[::ffff:7f00:1]"],
    ["127.0.0.1", "::ffff:127.0.0.1"],
    ["192.0.2.1", "::ffff:192.0.2.1"],
    ["192.0.2.1", "[::ffff:c000:201]"],
    ["255.255.255.255", "::ffff:ffff:ffff"],
    ["0.0.0.0", "::ffff:0:0"],
  ])("collapses %s and %s to the same IPv4 identity", (ipv4, mapped) => {
    expect(normalizeMtaAddress(ipv4)).toBe(ipv4);
    expect(normalizeMtaAddress(mapped)).toBe(ipv4);
    expect(normalizeMtaAddress(`  ${mapped}  `)).toBe(ipv4);
    expect(normalizeMtaAddress(normalizeMtaAddress(mapped))).toBe(ipv4);
    expect(isValidMtaAddress(ipv4)).toBe(true);
    expect(isValidMtaAddress(mapped)).toBe(true);
  });

  it("keeps ordinary hosts distinct from an IPv4-mapped alias", () => {
    expect(normalizeMtaAddress("[2001:DB8::1]")).toBe("[2001:db8::1]");
    expect(normalizeMtaAddress("fe80::abcd")).toBe("[fe80::abcd]");
    expect(normalizeMtaAddress("::1")).toBe("[::1]");
    expect(normalizeMtaAddress("::a00:1")).toBe("[::a00:1]");
    expect(normalizeMtaAddress("::ffff:0")).toBe("[::ffff:0]");
    expect(normalizeMtaAddress("::ffff:1:2:3")).toBe("[::ffff:1:2:3]");
    expect(normalizeMtaAddress("64:ff9b::10.0.0.1")).toBe("[64:ff9b::a00:1]");
    expect(normalizeMtaAddress("127.1")).toBe("127.0.0.1");
    expect(normalizeMtaAddress("  PLAY.Example.COM.  ")).toBe("play.example.com");
    expect(isValidMtaAddress("::ffff:10.0.0.999")).toBe(false);
    expect(isValidMtaAddress("::ffff:10.0.0.1.")).toBe(false);
    expect(isValidMtaAddress("fe80::abcd.")).toBe(false);
  });
});
