import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchResourceDownload } from "../../src/lib/resource-download-client";
import { controller, response, sha256 } from "../helpers/resource-download-client-harness";

afterEach(() => vi.useRealTimers());

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
    ).rejects.toMatchObject({ reason: digest === "bad" ? "failed" : "integrity" });
  });

  it("refuses altered bytes that retain the expected Content-Length", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("corrupt", { "X-Content-SHA256": sha256("archive") }));
    await expect(
      fetchResourceDownload("id", controller().signal, vi.fn(), fetcher),
    ).rejects.toMatchObject({ reason: "integrity" });
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
