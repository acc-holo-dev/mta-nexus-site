import { describe, expect, it } from "vitest";
import { getBuildSubmissionErrorMessage } from "../apps/web/src/lib/publishing-error-message";
import { getDictionary } from "../apps/web/src/lib/i18n";

describe("localized resource scan failures", () => {
  it.each([
    ["BUILD_UPLOAD_TOO_LARGE", "buildFileTooLarge"],
    ["BUILD_MALWARE_DETECTED", "scannerMalwareDetected"],
    ["BUILD_SCAN_LIMIT_EXCEEDED", "scannerLimitExceeded"],
    ["BUILD_SCANNER_UNAVAILABLE", "scannerUnavailable"],
  ] as const)("maps %s to both interface languages", (code, key) => {
    const english = getDictionary("en").publishing;
    const russian = getDictionary("ru").publishing;

    expect(
      getBuildSubmissionErrorMessage(code, {
        fileTooLarge: english.buildFileTooLarge,
        malwareDetected: english.scannerMalwareDetected,
        scanLimitExceeded: english.scannerLimitExceeded,
        scannerUnavailable: english.scannerUnavailable,
      }),
    ).toBe(english[key]);
    expect(
      getBuildSubmissionErrorMessage(code, {
        fileTooLarge: russian.buildFileTooLarge,
        malwareDetected: russian.scannerMalwareDetected,
        scanLimitExceeded: russian.scannerLimitExceeded,
        scannerUnavailable: russian.scannerUnavailable,
      }),
    ).toBe(russian[key]);
  });

  it("keeps unknown server errors available for fallback handling", () => {
    expect(
      getBuildSubmissionErrorMessage("SOME_NEW_SERVER_ERROR", {
        fileTooLarge: "too large",
        malwareDetected: "malware",
        scanLimitExceeded: "limits",
        scannerUnavailable: "unavailable",
      }),
    ).toBeUndefined();
  });

  it("describes resumable and reset actions in both languages", () => {
    expect(getDictionary("en").publishing.startNewResource).toBe(
      "Start a new resource",
    );
    expect(getDictionary("ru").publishing.startNewResource).toBe(
      "Начать новый ресурс",
    );
  });
});
