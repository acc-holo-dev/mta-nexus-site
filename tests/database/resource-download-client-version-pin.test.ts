import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchResourceDownload } from "../../apps/web/src/lib/resource-download-client";
import { controller, response } from "../helpers/resource-download-client-harness";

afterEach(() => vi.useRealTimers());

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
