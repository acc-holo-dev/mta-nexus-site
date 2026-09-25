import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  clamAvInstreamLimits,
  writeClamAvInstream,
  type ClamAvInstreamSocket,
} from "../apps/web/src/lib/services/clamav-instream";

class FakeSocket extends EventEmitter {
  readonly writes: Array<string | Uint8Array> = [];
  ended = false;
  private writeCount = 0;

  constructor(
    private readonly backpressureAt = new Set<number>(),
    private readonly closeInsteadOfDrain = false,
  ) {
    super();
  }

  write(chunk: string | Uint8Array): boolean {
    this.writes.push(chunk);
    this.writeCount += 1;

    if (this.backpressureAt.has(this.writeCount)) {
      queueMicrotask(() => {
        this.emit(this.closeInsteadOfDrain ? "close" : "drain");
      });
      return false;
    }
    return true;
  }

  end() {
    this.ended = true;
  }
}

function asSocket(fake: FakeSocket): ClamAvInstreamSocket {
  return fake as unknown as ClamAvInstreamSocket;
}

function uint32(chunk: string | Uint8Array): number {
  expect(typeof chunk).not.toBe("string");
  return Buffer.from(chunk as Uint8Array).readUInt32BE(0);
}

describe("ClamAV INSTREAM writer", () => {
  it("writes protocol command, bounded chunks, lengths and zero terminator", async () => {
    const bytes = new Uint8Array(clamAvInstreamLimits.chunkBytes + 3);
    bytes.fill(7);
    const socket = new FakeSocket();

    await writeClamAvInstream(asSocket(socket), bytes);

    expect(socket.ended).toBe(true);
    expect(socket.writes).toHaveLength(6);
    expect(socket.writes[0]).toBe("zINSTREAM\0");
    expect(uint32(socket.writes[1]!)).toBe(
      clamAvInstreamLimits.chunkBytes,
    );
    expect((socket.writes[2] as Uint8Array).byteLength).toBe(
      clamAvInstreamLimits.chunkBytes,
    );
    expect(uint32(socket.writes[3]!)).toBe(3);
    expect((socket.writes[4] as Uint8Array).byteLength).toBe(3);
    expect(uint32(socket.writes[5]!)).toBe(0);
  });

  it("waits for drain before continuing after socket backpressure", async () => {
    const socket = new FakeSocket(new Set([2]));
    const bytes = new Uint8Array([1, 2, 3]);

    await writeClamAvInstream(asSocket(socket), bytes);

    expect(socket.ended).toBe(true);
    expect(socket.writes).toHaveLength(4);
    expect(uint32(socket.writes[1]!)).toBe(3);
    expect(uint32(socket.writes[3]!)).toBe(0);
  });

  it("rejects when a backpressured socket closes before drain", async () => {
    const socket = new FakeSocket(new Set([2]), true);

    await expect(
      writeClamAvInstream(asSocket(socket), new Uint8Array([1])),
    ).rejects.toThrow(/closed before buffered data drained/u);

    expect(socket.ended).toBe(false);
  });
});
