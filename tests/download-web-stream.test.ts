import { Readable } from "node:stream";
import { expect, it } from "vitest";
import { toDownloadWebStream } from "../apps/web/src/lib/download-web-stream";

it("backpressures four unread 64 MiB downloads using bytes rather than chunk count", async () => {
  const fixtures = Array.from({ length: 4 }, () => {
    let produced = 0;
    const source = new Readable({
      highWaterMark: 64 * 1024,
      read() {
        if (produced === 64 * 1024 * 1024) this.push(null);
        else {
          produced += 64 * 1024;
          this.push(Buffer.alloc(64 * 1024));
        }
      },
    });
    return { source, web: toDownloadWebStream(source), produced: () => produced };
  });
  try {
    // Give an eager adapter ample time to fill its queue, without reading it.
    await new Promise((resolve) => setTimeout(resolve, 30));
    for (const fixture of fixtures) {
      expect(fixture.produced()).toBeGreaterThan(0);
      expect(fixture.produced()).toBeLessThanOrEqual(256 * 1024);
    }
  } finally {
    await Promise.all(fixtures.map(async ({ source, web }) => {
      const errors: Error[] = [];
      source.on("error", (error) => errors.push(error));
      const closed = new Promise<void>((resolve) => source.once("close", resolve));
      await web.cancel();
      await closed;
      expect(source.destroyed).toBe(true);
      expect(errors.every(error => error.name === "AbortError")).toBe(true);
    }));
  }
});

it("preserves ordered binary bytes across varied chunks and completes normally", async () => {
  const expected = Buffer.from(Array.from({ length: 200_000 }, (_, i) => i % 251));
  const source = Readable.from([expected.subarray(0, 3), expected.subarray(3, 99_999), expected.subarray(99_999)], { objectMode: false });
  const actual = Buffer.from(await new Response(toDownloadWebStream(source)).arrayBuffer());
  expect(actual).toEqual(expected);
});
