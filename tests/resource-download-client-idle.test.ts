import { afterEach, expect, it, vi } from "vitest";
import {
  DOWNLOAD_IDLE_TIMEOUT_MS,
  fetchResourceDownload,
} from "../apps/web/src/lib/resource-download-client";
import { controller, response, sha256 } from "./helpers/resource-download-client-harness";

afterEach(() => vi.useRealTimers());

it("does not fetch for an already cancelled request", async () => {
  const active = controller();
  active.abort();
  const fetcher = vi.fn<typeof fetch>();
  await expect(fetchResourceDownload("id", active.signal, vi.fn(), fetcher)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(fetcher).not.toHaveBeenCalled();
});

it("cancels a pending read even when no next chunk arrives", async () => {
  const active = controller();
  const cancelled = vi.fn();
  let started = () => {};
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        started();
      },
      cancel: cancelled,
    },
    { highWaterMark: 0 },
  );
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { headers: { "X-Content-SHA256": sha256("") } }));
  const download = fetchResourceDownload("id", active.signal, vi.fn(), fetcher);
  await reading;
  active.abort();
  await expect(download).rejects.toMatchObject({ name: "AbortError" });
  expect(cancelled).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});

it("does not await a stalled underlying cancel operation", async () => {
  const active = controller();
  let started = () => {};
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        started();
      },
      cancel() {
        return new Promise<void>(() => {});
      },
    },
    { highWaterMark: 0 },
  );
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { headers: { "X-Content-SHA256": sha256("") } }));
  const download = fetchResourceDownload("id", active.signal, vi.fn(), fetcher);
  await reading;
  active.abort();
  await expect(download).rejects.toMatchObject({ name: "AbortError" });
  expect(body.locked).toBe(false);
});

it("preserves the HTTP error when response cleanup fails", async () => {
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      throw new Error("cleanup failed");
    },
  });
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 401 }));
  await expect(
    fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
  ).rejects.toMatchObject({ reason: "signIn" });
});

it("removes the abort listener after successful reading", async () => {
  const active = controller();
  const remove = vi.spyOn(active.signal, "removeEventListener");
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
  await fetchResourceDownload("id", active.signal, vi.fn(), fetcher);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});

it("times out while waiting for response headers and clears its timer", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
  );
  const download = fetchResourceDownload("id", controller().signal, vi.fn(), fetcher);
  const rejected = expect(download).rejects.toMatchObject({ reason: "timeout" });
  await vi.advanceTimersByTimeAsync(DOWNLOAD_IDLE_TIMEOUT_MS);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels a stalled response body without saving partial bytes", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(stream) {
      stream.enqueue(new Uint8Array([1]));
    },
    cancel,
  });
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { headers: { "X-Content-SHA256": sha256("") } }));
  const download = fetchResourceDownload("id", controller().signal, vi.fn(), fetcher);
  const rejected = expect(download).rejects.toMatchObject({ reason: "timeout" });
  await vi.advanceTimersByTimeAsync(DOWNLOAD_IDLE_TIMEOUT_MS);
  await rejected;
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("allows a slow download to exceed the timeout while bytes keep arriving", async () => {
  vi.useFakeTimers();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      stream = value;
    },
  });
  const progress = vi.fn();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(body, {
      headers: { "X-Content-SHA256": sha256(new Uint8Array([0, 1, 2])) },
    }),
  );
  const download = fetchResourceDownload("id", controller().signal, progress, fetcher);
  for (let i = 0; i < 3; i++) {
    await vi.advanceTimersByTimeAsync(DOWNLOAD_IDLE_TIMEOUT_MS - 1);
    stream.enqueue(new Uint8Array([i]));
    await vi.advanceTimersByTimeAsync(0);
  }
  stream.close();
  expect((await download).blob.size).toBe(3);
  expect(progress).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not time out a complete download while its SHA-256 is being calculated", async () => {
  vi.useFakeTimers();
  const original = Blob.prototype.arrayBuffer;
  let started!: () => void;
  const hashing = new Promise<void>((resolve) => {
    started = resolve;
  });
  let resume!: () => void;
  const paused = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const hashSpy = vi.spyOn(Blob.prototype, "arrayBuffer").mockImplementation(async function (
    this: Blob,
  ) {
    started();
    await paused;
    return original.call(this);
  });

  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response("archive"));
  const download = fetchResourceDownload("id", controller().signal, vi.fn(), fetcher);
  try {
    await hashing;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(DOWNLOAD_IDLE_TIMEOUT_MS * 2);
  } finally {
    resume();
    hashSpy.mockRestore();
  }
  const result = await download;
  expect(await result.blob.text()).toBe("archive");
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves manual cancellation and releases the idle timer", async () => {
  vi.useFakeTimers();
  const active = controller();
  const body = new ReadableStream<Uint8Array>();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { headers: { "X-Content-SHA256": sha256("") } }));
  const download = fetchResourceDownload("id", active.signal, vi.fn(), fetcher);
  const rejected = expect(download).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(1);
  active.abort();
  await rejected;
  expect(body.locked).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not let empty chunks keep a stalled download alive", async () => {
  vi.useFakeTimers();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      stream = value;
    },
    cancel,
  });
  const progress = vi.fn();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(body, { headers: { "X-Content-SHA256": sha256("") } }));
  const download = fetchResourceDownload("id", controller().signal, progress, fetcher);
  const rejected = expect(download).rejects.toMatchObject({ reason: "timeout" });
  await vi.advanceTimersByTimeAsync(DOWNLOAD_IDLE_TIMEOUT_MS - 1);
  stream.enqueue(new Uint8Array(0));
  await vi.advanceTimersByTimeAsync(1);
  await rejected;
  expect(progress).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("snapshots reused stream buffers before subsequent reads mutate them", async () => {
  const buffer = new Uint8Array(4);
  let block = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(stream) {
        if (block === 3) {
          stream.close();
          return;
        }
        buffer.fill(++block);
        stream.enqueue(buffer);
      },
    },
    { highWaterMark: 0 },
  );
  const expectedBytes = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(body, {
      headers: { "X-Content-SHA256": sha256(expectedBytes) },
    }),
  );
  const result = await fetchResourceDownload("id", controller().signal, vi.fn(), fetcher);
  expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(
    new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]),
  );
});
