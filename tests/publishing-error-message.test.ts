import { describe, expect, it } from "vitest";
import { getBuildScanErrorMessage } from "../apps/web/src/lib/publishing-error-message";
import { getDictionary } from "../apps/web/src/lib/i18n";

describe("localized resource scan failures", () => {
  it.each([
    ["BUILD_MALWARE_DETECTED", "scannerMalwareDetected"],
    ["BUILD_SCAN_LIMIT_EXCEEDED", "scannerLimitExceeded"],
    ["BUILD_SCANNER_UNAVAILABLE", "scannerUnavailable"],
  ] as const)("maps %s to both interface languages", (code, key) => {
    const english = getDictionary("en").publishing;
    const russian = getDictionary("ru").publishing;

    expect(
      getBuildScanErrorMessage(code, {
        malwareDetected: english.scannerMalwareDetected,
        scanLimitExceeded: english.scannerLimitExceeded,
        scannerUnavailable: english.scannerUnavailable,
      }),
    ).toBe(english[key]);
    expect(
      getBuildScanErrorMessage(code, {
        malwareDetected: russian.scannerMalwareDetected,
        scanLimitExceeded: russian.scannerLimitExceeded,
        scannerUnavailable: russian.scannerUnavailable,
      }),
    ).toBe(russian[key]);
  });

  it("keeps unknown server errors available for fallback handling", () => {
    expect(
      getBuildScanErrorMessage("SOME_NEW_SERVER_ERROR", {
        malwareDetected: "malware",
        scanLimitExceeded: "limits",
        scannerUnavailable: "unavailable",
      }),
    ).toBeUndefined();
  });
});
