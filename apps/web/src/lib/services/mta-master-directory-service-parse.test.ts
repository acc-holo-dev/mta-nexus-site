import { describe, expect, it, vi } from "vitest";
import { parseMtaMasterList } from "./mta-master-directory-service";
import { fixture, text, u16, u32 } from "./mta-master-directory-service-harness";

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

  it("decodes several independent Unicode text fields within one entry", () => {
    const flags = 0x0020 | 0x0040;
    const entry = [203, 0, 113, 7, ...u16(22003), ...text("Русский сервер"), ...text("Гонки")];
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(flags),
      ...u32(0),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]).buffer;
    expect(parseMtaMasterList(payload)).toEqual([
      {
        address: "203.0.113.7",
        port: 22003,
        name: "Русский сервер",
        gameMode: "Гонки",
      },
    ]);
  });

  it("skips unneeded player names without decoding them", () => {
    const count = 1000;
    const playerNames = Array.from({ length: count }, (_, index) => text(`player-${index}`)).flat();
    const entry = [203, 0, 113, 7, ...u16(22003), ...u16(count), ...playerNames];
    const packet = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0800),
      ...u32(1),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]);
    const decode = vi.spyOn(TextDecoder.prototype, "decode");
    try {
      expect(parseMtaMasterList(packet.buffer)).toEqual([{ address: "203.0.113.7", port: 22003 }]);
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });

  it("rejects truncated ignored player names instead of reading into the next entry", () => {
    const entry = [203, 0, 113, 7, ...u16(22003), ...u16(1), 20, 65, 66];
    const packet = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0800),
      ...u32(1),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]);
    expect(() => parseMtaMasterList(packet.buffer)).toThrow("Truncated MTA master-list entry");
  });

  it("rejects a string crossing into the next server before decoding it", () => {
    const first = [203, 0, 113, 7, ...u16(22003), 8, 65];
    const second = [203, 0, 113, 8, ...u16(22004), 1, 66];
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0020),
      ...u32(1),
      ...u32(2),
      ...u16(first.length + 2),
      ...first,
      ...u16(second.length + 2),
      ...second,
      ...u32(0x12345679),
    ]);
    const decode = vi.spyOn(TextDecoder.prototype, "decode");
    try {
      expect(() => parseMtaMasterList(payload.buffer)).toThrow("Truncated MTA master-list entry");
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });

  it("rejects an optional field crossing into the EOF marker", () => {
    const entry = [203, 0, 113, 7, ...u16(22003)];
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0004),
      ...u32(1),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]);
    expect(() => parseMtaMasterList(payload.buffer)).toThrow("Truncated MTA master-list entry");
  });

  it("accepts endpoint-only entries when optional flags are absent", () => {
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0),
      ...u32(0),
      ...u32(1),
      ...u16(8),
      203,
      0,
      113,
      7,
      ...u16(22003),
      ...u32(0x12345679),
    ]).buffer;

    expect(parseMtaMasterList(payload)).toEqual([{ address: "203.0.113.7", port: 22003 }]);
  });

  it("rejects an incomplete payload", () => {
    expect(() => parseMtaMasterList(new Uint8Array([0, 0]).buffer)).toThrow(
      "Unsupported MTA master-list format",
    );
  });
  it("rejects an unsafe declared server count", () => {
    const payload = new Uint8Array([0, 0, 0, 2, ...u32(0), ...u32(1), ...u32(10001)]).buffer;

    expect(() => parseMtaMasterList(payload)).toThrow("server count exceeds safety limit");
  });

  it("rejects a declared server count when an entry is missing", () => {
    const payload = new Uint8Array([0, 0, 0, 2, ...u32(0), ...u32(1), ...u32(1)]).buffer;

    expect(() => parseMtaMasterList(payload)).toThrow("Truncated MTA master-list server entry");
  });

  it("rejects a truncated or corrupted version 2 EOF marker", () => {
    const valid = new Uint8Array(fixture());
    expect(() => parseMtaMasterList(valid.slice(0, -1).buffer)).toThrow("EOF marker");
    valid[valid.length - 1] ^= 1;
    expect(() => parseMtaMasterList(valid.buffer)).toThrow("EOF marker");
  });

  it("rejects bytes after the version 2 EOF marker", () => {
    const valid = new Uint8Array(fixture());
    const extra = new Uint8Array(valid.length + 1);
    extra.set(valid);
    expect(() => parseMtaMasterList(extra.buffer)).toThrow("EOF marker");
  });
});
