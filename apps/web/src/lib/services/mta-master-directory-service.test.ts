import { describe, expect, it } from "vitest";
import { parseMtaMasterList } from "./mta-master-directory-service";

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

  it("rejects an incomplete payload", () => {
    expect(() => parseMtaMasterList(new Uint8Array([0, 0]).buffer)).toThrow("Unsupported MTA master-list format");
  });
});
