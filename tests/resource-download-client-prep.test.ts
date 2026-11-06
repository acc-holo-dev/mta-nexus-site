import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOWNLOAD_IDLE_TIMEOUT_MS,
  fetchResourceDownload,
} from "../apps/web/src/lib/resource-download-client";
import { controller, response, sha256 } from "./helpers/resource-download-client-harness";

afterEach(() => vi.useRealTimers());

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
