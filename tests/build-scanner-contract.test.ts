import { describe, expect, it, vi } from "vitest";

vi.mock("@nexus/config", () => ({
  config: {
    BUILD_SCANNER: "disabled",
    CLAMAV_HOST: "127.0.0.1",
    CLAMAV_PORT: 3310,
  },
}));

import { buildScannerService } from "../apps/web/src/lib/services/build-scanner-service";

describe("disabled resource build scanner", () => {
  // TCP framing/verdicts, upload rejection, production configuration and
  // approval authorization have their own behavioral suites. This distinct
  // case prevents a disabled scanner from silently reporting a clean build.
  it("returns an explicit unscanned verdict with a timestamp", async () => {
    const startedAt = Date.now();
    const result = await buildScannerService.scan({
      bytes: new Uint8Array([1, 2, 3]),
      fileName: "build.zip",
    });

    expect(result).toMatchObject({
      status: "not_scanned",
      scanner: "disabled",
      scannedAt: expect.any(Date),
    });
    expect(result.scannedAt.getTime()).toBeGreaterThanOrEqual(startedAt);
    expect(result.scannedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
