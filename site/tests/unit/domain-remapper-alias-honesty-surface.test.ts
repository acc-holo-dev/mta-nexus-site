import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authorPublicationDeskError } from "../../src/features/community/author-publication-desk-copy";
import { communityReportError } from "../../src/features/community/community-report-copy";
import { discussionError } from "../../src/features/community/content-discussion-copy";
import { reactionError } from "../../src/features/community/content-reaction-copy";
import { publicationError } from "../../src/features/community/publication-feed-copy";
import { userPlatformError } from "../../src/features/community/user-platform-copy";
import { organizationContentMutationError } from "../../src/features/organizations/organization-content-copy";
import { organizationError } from "../../src/features/organizations/organization-workspace-copy";
import { serverContentMutationError } from "../../src/features/servers/server-content-copy";
import { serverWorkspaceError } from "../../src/features/servers/server-workspace-copy";
import { trustError } from "../../src/features/trust/public-user-trust-copy";
import { verificationError } from "../../src/features/trust/verification-workspace-copy";
import { followError } from "../../src/features/community/follow-workspace-copy";
import { notificationInboxError } from "../../src/features/notifications/notification-inbox-copy";
import { resourceCommerceError } from "../../src/features/resources/resource-commerce-i18n";
import { resourceManagementError } from "../../src/features/resources/resource-management-i18n";
import { resourceMediaError } from "../../src/features/resources/resource-media-i18n";

/** Waves 205–209 / 215–217 / 234–257: domain remappers must not fall through to publication editor wording. */
describe("domain remapper alias honesty surface", () => {
  it("keeps FORBIDDEN/ACTOR/RATE/CONFLICT on domain copy for both locales", () => {
    for (const locale of ["en", "ru"] as const) {
      const publicationForbidden = userPlatformError(locale, "FORBIDDEN");
      expect(communityReportError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(organizationError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(serverWorkspaceError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(discussionError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(reactionError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(authorPublicationDeskError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(verificationError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(publicationError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(trustError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(organizationContentMutationError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(serverContentMutationError(locale, "FORBIDDEN")).not.toBe(publicationForbidden);
      expect(followError(locale, "RATE_LIMITED")).toBe(followError(locale, "RATE_LIMIT_EXCEEDED"));
      expect(notificationInboxError(locale, "RATE_LIMITED")).toBe(
        notificationInboxError(locale, "RATE_LIMIT_EXCEEDED"),
      );
      expect(organizationError(locale, "VALIDATION_ERROR")).toBe(
        organizationError(locale, "VALIDATION_ERROR"),
      );
      expect(organizationError(locale, "VALIDATION_ERROR")).not.toBe(publicationForbidden);

      expect(communityReportError(locale, "ACTOR_ID_REQUIRED")).not.toBe(
        userPlatformError(locale, "FORBIDDEN"),
      );
      expect(organizationError(locale, "ACTOR_CHANGED")).toContain(
        locale === "ru" ? "аккаунт" : "account",
      );
      expect(discussionError(locale, "RATE_LIMIT_EXCEEDED")).toBe(
        discussionError(locale, "FORBIDDEN"),
      );
      expect(communityReportError(locale, "CONFLICT")).toBe(
        communityReportError(locale, "REPORT_STATE_CHANGED"),
      );
      expect(reactionError(locale, "UNAUTHORIZED")).toBe(
        reactionError(locale, "ACTOR_ID_REQUIRED"),
      );
    }
  });

  it("keeps org/server content RSC catches off publication userPlatformError", () => {
    for (const path of [
      "site/src/features/organizations/server/content-page.tsx",
      "site/src/features/organizations/server/organization-content-editor-page.tsx",
      "site/src/features/servers/server/server-content-editor-page.tsx",
      "site/src/app/workspace/servers/[id]/content/page.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).not.toContain("userPlatformError(locale, error.code)");
    }
  });

  it("aliases RATE_LIMITED onto RATE_LIMIT_EXCEEDED for key remappers", () => {
    for (const locale of ["en", "ru"] as const) {
      expect(userPlatformError(locale, "RATE_LIMITED")).toBe(
        userPlatformError(locale, "RATE_LIMIT_EXCEEDED"),
      );
      expect(resourceCommerceError(locale, "RATE_LIMITED")).toBe(
        resourceCommerceError(locale, "RATE_LIMIT_EXCEEDED"),
      );
      expect(resourceManagementError(locale, "RATE_LIMITED")).toBe(
        resourceManagementError(locale, "RATE_LIMIT_EXCEEDED"),
      );
      expect(resourceMediaError(locale, "RATE_LIMITED")).toBe(
        resourceMediaError(locale, "RATE_LIMIT_EXCEEDED"),
      );
    }
  });

  it("localizes comment client validation when locale is supplied", () => {
    const client = readFileSync(
      resolve(process.cwd(), "site/src/features/community/content-comment-client.ts"),
      "utf8",
    );
    const form = readFileSync(
      resolve(process.cwd(), "site/src/features/community/components/content-comment-form.tsx"),
      "utf8",
    );
    expect(client).toContain("discussionError(input.locale, code)");
    expect(client).toContain("ContentCommentSubmitError");
    expect(form).toContain("locale,");
    expect(form).toContain("fallbackError: copy.commentError");
  });
});
