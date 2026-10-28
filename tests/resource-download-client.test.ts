import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";
import {
  DOWNLOAD_IDLE_TIMEOUT_MS,
  fetchResourceDownload,
} from "../apps/web/src/lib/resource-download-client";

afterEach(() => vi.useRealTimers());

const controller = () => new AbortController();
const sha256 = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const response = (body = "archive", headers: Record<string, string> = {}) =>
  new Response(body, {
    headers: {
      "Content-Length": String(new TextEncoder().encode(body).byteLength),
      "X-Content-SHA256": sha256(body),
      ...headers,
    },
  });

describe("browser resource download preparation", () => {
  it.each(["dlv_receipt", "../private", "usr_other", "dlv_bad\n", ""])(
    "accepts only safe optional receipt links after byte verification: %j",
    async (id) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response("archive", { "X-Resource-Delivery-Id": id.replaceAll("\n", "%0A") }),
        );
      const result = await fetchResourceDownload("prd_a", controller().signal, vi.fn(), fetcher);
      expect(result.receiptId).toBe(id === "dlv_receipt" ? id : null);
    },
  );
  it("fetches privately and returns complete bytes with the server filename", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("archive", { "Content-Disposition": 'attachment; filename="resource-1.0.zip"' }),
      );
    const progress = vi.fn();
    const signal = controller().signal;
    const result = await fetchResourceDownload("product/id", signal, progress, fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/products/product%2Fid/download", {
      credentials: "same-origin",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(result.fileName).toBe("resource-1.0.zip");
    expect(await result.blob.text()).toBe("archive");
    expect(progress).toHaveBeenLastCalledWith(7, 7);
  });

  it.each([
    [401, "signIn"],
    [403, "access"],
    [404, "missing"],
    [409, "unavailable"],
    [429, "rateLimit"],
    [500, "failed"],
  ] as const)("maps HTTP %s to a localizable reason", async (status, reason) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("untrusted server error", { status }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason });
  });

  it.each(["../private.zip", "bad/name.zip", ".hidden", "bad\\name.zip"])(
    "never uses unsafe server filename %s",
    async (name) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response("archive", { "Content-Disposition": `attachment; filename="${name}"` }),
        );
      const result = await fetchResourceDownload("id", controller().signal, vi.fn(), fetcher);
      expect(result.fileName).toBe("resource.zip");
    },
  );

  it.each(["invalid", "0", "6", "8", String(MAX_UPLOAD_FILE_SIZE_BYTES + 1)])(
    "rejects incomplete or invalid declared length %s",
    async (length) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response("archive", { "Content-Length": length }));
      await expect(
        fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
      ).rejects.toMatchObject({ reason: "failed" });
    },
  );

  it("supports a bounded response without a declared length", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("archive", {
        headers: { "X-Content-SHA256": sha256("archive") },
      }),
    );
    const progress = vi.fn();
    const result = await fetchResourceDownload("id", controller().signal, progress, fetcher);
    expect(await result.blob.text()).toBe("archive");
    expect(progress).toHaveBeenCalledWith(7, null);
  });

  it("does not return bytes after cancellation during reading", async () => {
    const active = controller();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    await expect(
      fetchResourceDownload("id", active.signal, () => active.abort(), fetcher),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cancels an oversized stream even without a length header", async () => {
    let reads = 0;
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        reads++;
        ctrl.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel: cancelled,
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(body, { headers: { "X-Content-SHA256": sha256("") } }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "failed" });
    expect(cancelled).toHaveBeenCalledOnce();
    // Confirm this covered the real 64-MiB stream limit, not a missing-hash
    // preflight rejection that would cancel the body before any read.
    expect(reads).toBeGreaterThan(64);
    expect(reads).toBeLessThanOrEqual(66);
  });
});

it.each(["text/html", "application/json"])(
  "does not save an unexpected %s response as an archive",
  async (mime) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("error", { "Content-Type": mime }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "failed" });
  },
);

it("does not compare decoded bytes with a proxy's compressed content length", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response("archive", { "Content-Encoding": "gzip", "Content-Length": "3" }));
  const progress = vi.fn();
  const result = await fetchResourceDownload("id", controller().signal, progress, fetcher);
  expect(await result.blob.text()).toBe("archive");
  expect(progress).toHaveBeenCalledWith(7, null);
});

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

describe("explicit version download URL", () => {
  it("pins a selected release while retaining same-origin, no-store and the original API", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("archive", { "X-Resource-Build-Id": "bld_version_1" }));
    const result = await fetchResourceDownload(
      "prd_resource",
      controller().signal,
      vi.fn(),
      fetcher,
      "bld_version_1",
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/products/prd_resource/download?buildId=bld_version_1",
      expect.objectContaining({
        credentials: "same-origin",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await result.blob.text()).toBe("archive");
  });

  it("does not hand off a different build from the requested pinned version", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("archive", { "X-Resource-Build-Id": "bld_different" }));
    await expect(
      fetchResourceDownload("prd_resource", controller().signal, vi.fn(), fetcher, "bld_version_1"),
    ).rejects.toMatchObject({ reason: "failed" });
  });

  it("refuses a pinned download without the selected-build echo header", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response("archive"));
    await expect(
      fetchResourceDownload("prd_resource", controller().signal, vi.fn(), fetcher, "bld_version_1"),
    ).rejects.toMatchObject({ reason: "failed" });
  });

  it("does not send a request when the pinned version identifier is invalid", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      fetchResourceDownload(
        "prd_resource",
        controller().signal,
        vi.fn(),
        fetcher,
        "../private-file",
      ),
    ).rejects.toThrow("Invalid resource build identifier");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("SHA-256 verification before saving", () => {
  it.each([
    null,
    "invalid",
    "a".repeat(63),
    "a".repeat(65),
    `${"a".repeat(64)}, ${"b".repeat(64)}`,
  ])("rejects invalid digest headers before reading archive bytes: %s", async (digest) => {
    const cancelled = vi.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls++;
          controller.enqueue(new Uint8Array(1024));
        },
        cancel: cancelled,
      },
      { highWaterMark: 0 },
    );
    const headers = digest === null ? undefined : { "X-Content-SHA256": digest };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "failed" });
    expect(cancelled).toHaveBeenCalledOnce();
    expect(pulls).toBe(0);
  });
  it("refuses a successful response without a digest", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("archive", { headers: { "Content-Length": "7" } }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "failed" });
  });

  it.each(["bad", "0".repeat(64)])("rejects invalid or mismatched digest %s", async (digest) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("archive", { "X-Content-SHA256": digest }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "failed" });
  });

  it("refuses altered bytes that retain the expected Content-Length", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("corrupt", { "X-Content-SHA256": sha256("archive") }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "failed" });
  });

  it("accepts uppercase canonical SHA-256", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response("archive", { "X-Content-SHA256": sha256("archive").toUpperCase() }),
      );
    expect(
      (await fetchResourceDownload("id", controller().signal, vi.fn(), fetcher)).blob.size,
    ).toBe(7);
  });
});
