import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { expect, it, vi } from "vitest";
import { resourceDeliveryStream } from "../apps/web/src/lib/resource-delivery-stream";
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function fixture(
  source = Readable.from([Buffer.from("archive")], { objectMode: false }),
  options: { size?: number; hash?: string } = {},
) {
  const signal = new AbortController(),
    finish = vi.fn(async () => undefined),
    recordFailure = vi.fn();
  const stream = resourceDeliveryStream({
    source,
    expectedBytes: options.size ?? 7,
    sha256Hash: options.hash ?? sha("archive"),
    signal: signal.signal,
    finish,
    recordFailure,
  });
  return { signal, source, finish, recordFailure, stream };
}
it("records served only after the consumer drains and verifies every byte", async () => {
  const f = fixture(),
    reader = f.stream.getReader();
  expect((await reader.read()).value).toEqual(new TextEncoder().encode("archive"));
  expect(f.finish).not.toHaveBeenCalled();
  expect(await reader.read()).toEqual({ done: true, value: undefined });
  expect(f.finish).toHaveBeenCalledExactlyOnceWith({
    status: "served",
    bytesSent: 7,
    errorCode: null,
  });
});
it("cancellation after the last chunk is distinct from a verified EOF", async () => {
  const f = fixture(),
    reader = f.stream.getReader();
  await reader.read();
  await reader.cancel();
  f.signal.abort();
  expect(f.finish).toHaveBeenCalledExactlyOnceWith({
    status: "cancelled",
    bytesSent: 7,
    errorCode: null,
  });
  expect(f.source.destroyed).toBe(true);
});
it("records an unread response cancellation with zero emitted bytes", async () => {
  const f = fixture();
  await f.stream.cancel();
  expect(f.finish).toHaveBeenCalledExactlyOnceWith({
    status: "cancelled",
    bytesSent: 0,
    errorCode: null,
  });
});
it("aborts a pending storage read without waiting for another chunk", async () => {
  const f = fixture(new Readable({ read() {} })),
    reader = f.stream.getReader(),
    pending = reader.read();
  f.signal.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(f.source.destroyed).toBe(true));
  expect(f.finish).toHaveBeenCalledExactlyOnceWith({
    status: "cancelled",
    bytesSent: 0,
    errorCode: null,
  });
});
it("handles a signal aborted before the response stream is constructed", async () => {
  const signal = AbortSignal.abort(),
    finish = vi.fn(async () => undefined),
    source = Readable.from([Buffer.from("archive")]);
  const stream = resourceDeliveryStream({
    source,
    expectedBytes: 7,
    sha256Hash: sha("archive"),
    signal,
    finish,
    recordFailure: vi.fn(),
  });
  await expect(new Response(stream).arrayBuffer()).rejects.toMatchObject({ name: "AbortError" });
  expect(finish).toHaveBeenCalledExactlyOnceWith({
    status: "cancelled",
    bytesSent: 0,
    errorCode: null,
  });
});
it.each([
  ["short", "size_mismatch", 5],
  ["changed", "hash_mismatch", 7],
  ["too-large", "size_mismatch", 0],
] as const)(
  "rejects %s storage bytes without claiming completion",
  async (bytes, errorCode, bytesSent) => {
    const f = fixture(Readable.from([Buffer.from(bytes)], { objectMode: false }));
    await expect(new Response(f.stream).arrayBuffer()).rejects.toThrow("integrity check");
    expect(f.finish).toHaveBeenCalledExactlyOnceWith({ status: "failed", bytesSent, errorCode });
  },
);
it("records a stream failure with only bytes already emitted and no raw error", async () => {
  const source = Readable.from(
    (async function* () {
      yield Buffer.from("arc");
      throw new Error("private storage path");
    })(),
    { objectMode: false },
  );
  const f = fixture(source),
    reader = f.stream.getReader();
  await reader.read();
  await expect(reader.read()).rejects.toThrow();
  expect(f.finish).toHaveBeenCalledExactlyOnceWith({
    status: "failed",
    bytesSent: 3,
    errorCode: "storage_error",
  });
});
it("preserves successful bytes when result persistence fails and reports uncertainty", async () => {
  const f = fixture();
  f.finish.mockRejectedValueOnce(new Error("database unavailable"));
  expect(await new Response(f.stream).text()).toBe("archive");
  expect(f.recordFailure).toHaveBeenCalledTimes(1);
});
it("keeps four unread 64 MiB transfers bounded and unconfirmed", async () => {
  const fixtures = Array.from({ length: 4 }, () => {
    let produced = 0;
    const source = new Readable({
      highWaterMark: 65536,
      read() {
        if (produced === 67108864) this.push(null);
        else {
          produced += 65536;
          this.push(Buffer.alloc(65536));
        }
      },
    });
    return { ...fixture(source, { size: 67108864 }), produced: () => produced };
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 25));
    for (const f of fixtures) {
      expect(f.produced()).toBeLessThanOrEqual(262144);
      expect(f.finish).not.toHaveBeenCalled();
    }
  } finally {
    await Promise.all(fixtures.map((f) => f.stream.cancel()));
  }
});
