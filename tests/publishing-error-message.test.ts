import { describe, expect, it } from "vitest";
import { getResourceSubmissionErrorMessage } from "../apps/web/src/lib/publishing-error-message";
import { getDictionary } from "../apps/web/src/lib/i18n";

describe("localized resource submission failures", () => {
  it.each([
    ["BUILD_UPLOAD_TOO_LARGE", "buildFileTooLarge"],
    ["BUILD_MALWARE_DETECTED", "scannerMalwareDetected"],
    ["BUILD_SCAN_LIMIT_EXCEEDED", "scannerLimitExceeded"],
    ["BUILD_SCANNER_UNAVAILABLE", "scannerUnavailable"],
  ] as const)("maps %s to both interface languages", (code, key) => {
    const english = getDictionary("en").publishing;
    const russian = getDictionary("ru").publishing;

    expect(
      getResourceSubmissionErrorMessage(code, {
        fileTooLarge: english.buildFileTooLarge,
        malwareDetected: english.scannerMalwareDetected,
        scanLimitExceeded: english.scannerLimitExceeded,
        scannerUnavailable: english.scannerUnavailable,
      }),
    ).toBe(english[key]);
    expect(
      getResourceSubmissionErrorMessage(code, {
        fileTooLarge: russian.buildFileTooLarge,
        malwareDetected: russian.scannerMalwareDetected,
        scanLimitExceeded: russian.scannerLimitExceeded,
        scannerUnavailable: russian.scannerUnavailable,
      }),
    ).toBe(russian[key]);
  });

  it("keeps unknown server errors available for fallback handling", () => {
    expect(
      getResourceSubmissionErrorMessage("SOME_NEW_SERVER_ERROR", {
        fileTooLarge: "too large",
        malwareDetected: "malware",
        scanLimitExceeded: "limits",
        scannerUnavailable: "unavailable",
      }),
    ).toBeUndefined();
  });

  it.each([
    ["BUILD_VERSION_EXISTS", "versionAlreadyExists"],
    ["UNAUTHORIZED", "authenticationRequired"],
    ["RATE_LIMIT_EXCEEDED", "uploadRateLimited"],
    ["NOT_FOUND", "resourceNotFound"],
    ["FORBIDDEN", "buildForbidden"],
    ["PAID_RESOURCES_DISABLED", "paidPublishingUnavailable"],
    ["BUILD_MULTIPART_REQUIRED", "multipartRequired"],
    ["BUILD_MULTIPART_INVALID", "multipartInvalid"],
    ["BUILD_METADATA_INVALID", "metadataInvalid"],
    ["BUILD_FILE_TYPE_NOT_ALLOWED", "buildFileTypeNotAllowed"],
    ["BUILD_CONTENT_MISMATCH", "buildContentMismatch"],
    ["BUILD_FILE_NAME_INVALID", "buildFileNameInvalid"],
    ["PRODUCT_METADATA_INVALID", "resourceMetadataInvalid"],
    ["PRODUCT_SLUG_EXISTS", "resourceSlugAlreadyExists"],
    ["RESOURCE_CREATION_FAILED", "resourceCreationFailed"],
  ] as const)("localizes %s for both interface languages", (code, key) => {
    const english = getDictionary("en").publishing;
    const russian = getDictionary("ru").publishing;
    const messages = (copy: typeof english) => ({
      fileTooLarge: copy.buildFileTooLarge,
      malwareDetected: copy.scannerMalwareDetected,
      scanLimitExceeded: copy.scannerLimitExceeded,
      scannerUnavailable: copy.scannerUnavailable,
      [key]: copy[key],
    });

    expect(getResourceSubmissionErrorMessage(code, messages(english))).toBe(
      english[key],
    );
    expect(getResourceSubmissionErrorMessage(code, messages(russian))).toBe(
      russian[key],
    );
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
