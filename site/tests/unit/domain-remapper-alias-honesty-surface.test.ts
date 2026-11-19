import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authorPublicationDeskError } from "../../src/features/community/author-publication-desk-copy";
import { communityReportError } from "../../src/features/community/community-report-copy";
import { discussionError } from "../../src/features/community/content-discussion-copy";
import { reactionError } from "../../src/features/community/content-reaction-copy";
import { publicationError } from "../../src/features/community/publication-feed-copy";
import { userPlatformError } from "../../src/features/community/user-platform-copy";
import { organizationError } from "../../src/features/organizations/organization-workspace-copy";
import { serverWorkspaceError } from "../../src/features/servers/server-workspace-copy";
import { trustError } from "../../src/features/trust/public-user-trust-copy";
import { verificationError } from "../../src/features/trust/verification-workspace-copy";

/** Waves 205–209 / 215–217: domain remappers must not fall through to publication editor wording. */
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
