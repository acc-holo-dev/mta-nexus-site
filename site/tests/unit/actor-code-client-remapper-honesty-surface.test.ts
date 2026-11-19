import { expect, it } from "vitest";
import { privateChangeHistoryError } from "../../src/features/accounts/private-change-history-copy";
import { profilePrivacyError } from "../../src/features/accounts/profile-privacy-copy";
import { commercialError } from "../../src/features/commerce/commercial-i18n";
import { licenseControlError } from "../../src/features/commerce/license-control-i18n";
import { planReviewError } from "../../src/features/commerce/plan-reviews-i18n";
import { subscriptionError } from "../../src/features/commerce/subscriptions-i18n";
import { moderationError } from "../../src/features/community/community-moderation-copy";
import { followError } from "../../src/features/community/follow-workspace-copy";
import { libraryCollectionError } from "../../src/features/library/library-collections-i18n";
import { resourceReleaseControlError } from "../../src/features/library/resource-release-control-i18n";
import { platformReportError } from "../../src/features/moderation/platform-report-i18n";
import { notificationInboxError } from "../../src/features/notifications/notification-inbox-copy";
import { getResourceSubmissionErrorMessage } from "../../src/features/resources/publishing-error-message";
import { resourceCommerceError } from "../../src/features/resources/resource-commerce-i18n";
import { resourceCopyError } from "../../src/features/resources/resource-copy-i18n";
import { resourceManagementError } from "../../src/features/resources/resource-management-i18n";
import { resourceMediaError } from "../../src/features/resources/resource-media-i18n";
import { resourceQaError } from "../../src/features/resources/resource-qa-i18n";
import { resourceReviewError } from "../../src/features/resources/resource-review-i18n";
import { getServerClaimStatusCopy } from "../../src/features/servers/server-claim-status-view";
import { serverReviewError } from "../../src/features/servers/server-review-i18n";
import { serverStatisticsError } from "../../src/features/servers/server-statistics-copy";

it("maps ACTOR_* codes in high-traffic client remappers for both locales", () => {
  for (const locale of ["en", "ru"] as const) {
    expect(resourceCommerceError(locale, "ACTOR_ID_REQUIRED")).not.toBe(
      resourceCommerceError(locale, "UNKNOWN_CODE"),
    );
    expect(resourceManagementError(locale, "ACTOR_CHANGED")).not.toBe(
      resourceManagementError(locale, "UNKNOWN_CODE"),
    );
    expect(resourceQaError(locale, "ACTOR_ID_REQUIRED")).not.toBe(
      resourceQaError(locale, "UNKNOWN_CODE"),
    );
    expect(resourceCopyError(locale, "ACTOR_CHANGED")).not.toMatch(/retry|Повтор/iu);
    expect(resourceReviewError(locale, "ACTOR_CHANGED")).toBe(
      resourceReviewError(locale, "REVIEW_CHANGED"),
    );
    expect(planReviewError(locale, "ACTOR_ID_REQUIRED")).toBe(
      planReviewError(locale, "UNAUTHORIZED"),
    );
    expect(serverReviewError(locale, "ACTOR_CHANGED")).toBe(
      serverReviewError(locale, "REVIEW_CHANGED"),
    );
    expect(libraryCollectionError(locale, "ACTOR_ID_REQUIRED")).toBe(
      libraryCollectionError(locale, "UNAUTHORIZED"),
    );
    expect(profilePrivacyError(locale, "ACTOR_CHANGED")).toBe(
      profilePrivacyError(locale, "ACCOUNT_CHANGED"),
    );
    expect(privateChangeHistoryError(locale, "ACTOR_ID_REQUIRED")).toBe(
      privateChangeHistoryError(locale, "UNAUTHORIZED"),
    );
    expect(platformReportError(locale, "ACTOR_ID_REQUIRED")).toBe(
      platformReportError(locale, "UNAUTHORIZED"),
    );
    expect(serverStatisticsError(locale, "ACTOR_ID_REQUIRED")).toBe(
      serverStatisticsError(locale, "UNAUTHORIZED"),
    );
    expect(resourceMediaError(locale, "ACTOR_ID_REQUIRED")).not.toBe(
      resourceMediaError(locale, "UNKNOWN_CODE"),
    );
    expect(moderationError(locale, "ACTOR_CHANGED")).toBe(
      moderationError(locale, "CONTENT_STATE_CHANGED"),
    );
    expect(moderationError(locale, "ACTOR_ID_REQUIRED")).toBe(
      moderationError(locale, "UNAUTHORIZED"),
    );
  }
  expect(resourceCommerceError("ru", "ACTOR_CHANGED")).toContain("аккаунт");
  expect(resourceManagementError("en", "ACTOR_ID_REQUIRED")).toContain("Reload");
  expect(resourceMediaError("en", "FORBIDDEN")).toContain("permission");
  expect(resourceMediaError("ru", "VALIDATION_ERROR")).toContain("подпись");
});

it("maps VALIDATION_ERROR aliases and FORBIDDEN fills without English code passthrough", () => {
  for (const locale of ["en", "ru"] as const) {
    expect(commercialError(locale, "VALIDATION_ERROR")).toBe(
      commercialError(locale, "COMMERCIAL_PLAN_INVALID"),
    );
    expect(licenseControlError(locale, "VALIDATION_ERROR")).toBe(
      licenseControlError(locale, "VALIDATION_FAILED"),
    );
    expect(resourceReleaseControlError(locale, "VALIDATION_ERROR")).toBe(
      resourceReleaseControlError(locale, "RESOURCE_CONTROL_INVALID"),
    );
    expect(resourceCommerceError(locale, "VALIDATION_ERROR")).toBe(
      resourceCommerceError(locale, "VALIDATION_FAILED"),
    );
    expect(resourceQaError(locale, "VALIDATION_ERROR")).toBe(
      resourceQaError(locale, "RESOURCE_QA_INVALID"),
    );
    expect(resourceManagementError(locale, "VALIDATION_ERROR")).not.toBe(
      resourceManagementError(locale, "UNKNOWN_CODE"),
    );
    expect(resourceManagementError(locale, "FORBIDDEN")).not.toBe(
      resourceManagementError(locale, "UNKNOWN_CODE"),
    );
    expect(planReviewError(locale, "VALIDATION_ERROR")).toBe(
      planReviewError(locale, "PLAN_REVIEW_INVALID"),
    );
    expect(resourceReviewError(locale, "VALIDATION_ERROR")).toBe(
      resourceReviewError(locale, "REVIEW_INVALID"),
    );
    expect(libraryCollectionError(locale, "VALIDATION_ERROR")).toBe(
      libraryCollectionError(locale, "COLLECTION_INVALID"),
    );
    expect(serverReviewError(locale, "FORBIDDEN")).toBe(
      serverReviewError(locale, "REVIEW_ACCESS_REQUIRED"),
    );
    expect(serverReviewError(locale, "VALIDATION_ERROR")).toBe(
      serverReviewError(locale, "REVIEW_INVALID"),
    );
    expect(privateChangeHistoryError(locale, "FORBIDDEN")).toBe(
      privateChangeHistoryError(locale, "UNKNOWN_CODE"),
    );
    expect(platformReportError(locale, "FORBIDDEN")).toBe(
      platformReportError(locale, "UNKNOWN_CODE"),
    );
  }
});

it("maps ACTOR_* in publishing and server-claim remappers", () => {
  const publishing = {
    fileTooLarge: "large",
    malwareDetected: "malware",
    scanLimitExceeded: "scan-limit",
    scannerUnavailable: "scanner",
    authenticationRequired: "auth-required",
  };
  expect(getResourceSubmissionErrorMessage("ACTOR_ID_REQUIRED", publishing)).toBe("auth-required");
  expect(getResourceSubmissionErrorMessage("ACTOR_CHANGED", publishing)).toBe("auth-required");
  expect(getResourceSubmissionErrorMessage("UNAUTHORIZED", publishing)).toBe("auth-required");

  for (const locale of ["en", "ru"] as const) {
    const errors = getServerClaimStatusCopy(locale).errors;
    expect(errors.ACTOR_ID_REQUIRED).toBeTruthy();
    expect(errors.ACTOR_CHANGED).toBeTruthy();
    expect(errors.UNAUTHORIZED).toBeTruthy();
    expect(errors.ACTOR_ID_REQUIRED).not.toEqual(errors.FORBIDDEN);
  }
  expect(getServerClaimStatusCopy("en").errors.ACTOR_ID_REQUIRED).toContain("Reload");
  expect(getServerClaimStatusCopy("ru").errors.ACTOR_CHANGED).toContain("аккаунт");
});

it("maps bare CONFLICT and residual VALIDATION_ERROR without English code passthrough", () => {
  for (const locale of ["en", "ru"] as const) {
    expect(commercialError(locale, "CONFLICT")).not.toBe(commercialError(locale, "UNKNOWN_CODE"));
    expect(licenseControlError(locale, "CONFLICT")).toBe(
      licenseControlError(locale, "LICENSE_CONFLICT"),
    );
    expect(resourceCommerceError(locale, "CONFLICT")).toBe(
      resourceCommerceError(locale, "PRODUCT_METADATA_CONFLICT"),
    );
    expect(resourceManagementError(locale, "CONFLICT")).toBe(
      resourceManagementError(locale, "PRODUCT_METADATA_CONFLICT"),
    );
    expect(resourceMediaError(locale, "CONFLICT")).toBe(
      resourceMediaError(locale, "RESOURCE_MEDIA_CONFLICT"),
    );
    expect(resourceQaError(locale, "CONFLICT")).toBe(
      resourceQaError(locale, "RESOURCE_QA_CHANGED"),
    );
    expect(resourceReleaseControlError(locale, "CONFLICT")).toBe(
      resourceReleaseControlError(locale, "LIBRARY_RELEASE_CONFLICT"),
    );
    expect(resourceCopyError(locale, "VALIDATION_ERROR")).toBe(
      resourceCopyError(locale, "RESOURCE_COPY_INVALID"),
    );
    expect(resourceCopyError(locale, "CONFLICT")).toBe(
      resourceCopyError(locale, "RESOURCE_COPY_REQUEST_CONFLICT"),
    );
    expect(subscriptionError(locale, "VALIDATION_ERROR")).toBe(
      subscriptionError(locale, "SUBSCRIPTION_INVALID"),
    );
    expect(subscriptionError(locale, "CONFLICT")).toBe(
      subscriptionError(locale, "SUBSCRIPTION_REQUEST_CONFLICT"),
    );
    expect(notificationInboxError(locale, "CONFLICT")).toBe(
      notificationInboxError(locale, "NOTIFICATION_STATE_CHANGED"),
    );
    expect(resourceReviewError(locale, "CONFLICT")).toBe(
      resourceReviewError(locale, "REVIEW_CHANGED"),
    );
    expect(serverReviewError(locale, "CONFLICT")).toBe(serverReviewError(locale, "REVIEW_CHANGED"));
    expect(serverStatisticsError(locale, "CONFLICT")).toBe(
      serverStatisticsError(locale, "ACTOR_CHANGED"),
    );
    expect(privateChangeHistoryError(locale, "CONFLICT")).toBe(
      privateChangeHistoryError(locale, "FORBIDDEN"),
    );
    expect(followError(locale, "CONFLICT")).toBe(followError(locale, "UNKNOWN_CODE"));
    expect(platformReportError(locale, "VALIDATION_ERROR")).toBe(
      platformReportError(locale, "UNKNOWN_CODE"),
    );
  }
});
