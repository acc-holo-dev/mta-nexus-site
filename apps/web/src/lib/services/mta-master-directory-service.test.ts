import { describe, expect, it } from "vitest";
import {
  matchesMtaEndpoint,
  normalizeMtaAddress,
  parseMtaMasterList,
} from "./mta-master-directory-service";

const FLAGS = 0x0004 | 0x0008 | 0x0020 | 0x0040 | 0x0080 | 0x0100 | 0x0200 | 0x1000 | 0x080000;

function u16(value: number) {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function u32(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function text(value: string) {
  const bytes = [...new TextEncoder().encode(value)];
  return [bytes.length, ...bytes];
}

function fixture() {
  const entry = [
    127, 0, 0, 1,
    ...u16(22003),
    ...u16(42),
    ...u16(128),
    ...text("Nexus test server"),
    ...text("roleplay"),
    ...text("Los Santos"),
    ...text("1.6"),
    1,
    0,
    ...u16(22005),
  ];

  return new Uint8Array([
    0, 0, 0, 2,
    ...u32(FLAGS),
    ...u32(7),
    ...u32(1),
    ...u16(entry.length + 2),
    ...entry,
    0x12, 0x34, 0x56, 0x79,
  ]).buffer;
}

describe("parseMtaMasterList", () => {
  it("parses extended master-list entries in network byte order", () => {
    expect(parseMtaMasterList(fixture())).toEqual([
      {
        address: "127.0.0.1",
        port: 22003,
        players: 42,
        maxPlayers: 128,
        name: "Nexus test server",
        gameMode: "roleplay",
        mapName: "Los Santos",
        version: "1.6",
        passworded: true,
        responding: true,
        httpPort: 22005,
      },
    ]);
  });

  it("accepts endpoint-only entries when optional flags are absent", () => {
    const payload = new Uint8Array([
      0, 0, 0, 2,
      ...u32(0),
      ...u32(0),
      ...u32(1),
      ...u16(8),
      203, 0, 113, 7,
      ...u16(22003),
    ]).buffer;

    expect(parseMtaMasterList(payload)).toEqual([
      { address: "203.0.113.7", port: 22003 },
    ]);
  });

  it("rejects an incomplete payload", () => {
    expect(() => parseMtaMasterList(new Uint8Array([0, 0]).buffer)).toThrow("Unsupported MTA master-list format");
  });
  it("rejects an unsafe declared server count", () => {
    const payload = new Uint8Array([
      0, 0, 0, 2,
      ...u32(0),
      ...u32(1),
      ...u32(10001),
    ]).buffer;

    expect(() => parseMtaMasterList(payload)).toThrow("server count exceeds safety limit");
  });

  it("rejects a declared server count when an entry is missing", () => {
    const payload = new Uint8Array([
      0, 0, 0, 2,
      ...u32(0),
      ...u32(1),
      ...u32(1),
    ]).buffer;

    expect(() => parseMtaMasterList(payload)).toThrow("Truncated MTA master-list server entry");
  });
});

describe("editorial/live endpoint matching", () => {
  it("normalizes case, whitespace and a trailing hostname dot", () => {
    expect(normalizeMtaAddress("  Play.Example.COM. ")).toBe("play.example.com");
    expect(matchesMtaEndpoint(
      { ipAddress: " PLAY.EXAMPLE.COM. ", port: 22003 },
      { address: "play.example.com", port: 22003 }
    )).toBe(true);
  });

  it("never matches a different port", () => {
    expect(matchesMtaEndpoint(
      { ipAddress: "127.0.0.1", port: 22003 },
      { address: "127.0.0.1", port: 22004 }
    )).toBe(false);
  });
});
