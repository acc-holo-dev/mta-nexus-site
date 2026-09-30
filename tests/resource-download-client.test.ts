import { describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";
import { fetchResourceDownload } from "../apps/web/src/lib/resource-download-client";

const controller = () => new AbortController();
const response = (body = "archive", headers: Record<string, string> = {}) =>
  new Response(body, { headers: { "Content-Length": String(body.length), ...headers } });

describe("browser resource download preparation", () => {
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
      signal,
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
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("archive"));
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
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "failed" });
    expect(cancelled).toHaveBeenCalledOnce();
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
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
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
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
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
