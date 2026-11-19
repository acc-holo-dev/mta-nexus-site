import { expect, it } from "vitest";
import { privateChangeHistoryError } from "../../src/features/accounts/private-change-history-copy";
import { profilePrivacyError } from "../../src/features/accounts/profile-privacy-copy";
import { planReviewError } from "../../src/features/commerce/plan-reviews-i18n";
import { libraryCollectionError } from "../../src/features/library/library-collections-i18n";
import { platformReportError } from "../../src/features/moderation/platform-report-i18n";
import { resourceCommerceError } from "../../src/features/resources/resource-commerce-i18n";
import { resourceCopyError } from "../../src/features/resources/resource-copy-i18n";
import { resourceManagementError } from "../../src/features/resources/resource-management-i18n";
import { resourceQaError } from "../../src/features/resources/resource-qa-i18n";
import { resourceReviewError } from "../../src/features/resources/resource-review-i18n";
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
  }
  expect(resourceCommerceError("ru", "ACTOR_CHANGED")).toContain("аккаунт");
  expect(resourceManagementError("en", "ACTOR_ID_REQUIRED")).toContain("Reload");
});
