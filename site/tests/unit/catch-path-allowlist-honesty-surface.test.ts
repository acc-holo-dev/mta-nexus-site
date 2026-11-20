import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Waves 210–268: catch paths only surface allowlisted locale copy. */
describe("catch-path allowlist honesty surface", () => {
  it.each([
    "site/src/features/organizations/components/organization-team-directory.tsx",
    "site/src/features/organizations/components/organization-team-batch.tsx",
    "site/src/features/community/components/follow-workspace.tsx",
    "site/src/features/community/components/discussion-comment-actions.tsx",
    "site/src/features/community/components/moderated-discussion-removal.tsx",
    "site/src/features/community/components/community-report-detail.tsx",
    "site/src/features/community/components/community-report-list.tsx",
    "site/src/features/community/components/community-report-form.tsx",
    "site/src/features/community/components/content-discussion.tsx",
    "site/src/features/moderation/components/verification-workspace.tsx",
    "site/src/features/moderation/components/verification-moderation-controls.tsx",
    "site/src/features/organizations/components/organization-workspace.tsx",
    "site/src/features/organizations/components/organization-ownership-transfer.tsx",
    "site/src/features/organizations/components/organization-profile-form.tsx",
    "site/src/features/community/components/author-content-form.tsx",
    "site/src/features/accounts/components/public-profile-form.tsx",
    "site/src/features/accounts/components/developer-profile-editor.tsx",
    "site/src/features/accounts/components/profile-privacy-editor.tsx",
    "site/src/features/community/components/content-comment-form.tsx",
    "site/src/features/community/components/community-topic-form.tsx",
    "site/src/features/servers/components/register-server-form.tsx",
    "site/src/features/servers/components/server-details-form.tsx",
    "site/src/features/resources/components/new-resource-form.tsx",
    "site/src/features/resources/components/resource-cart-controls.tsx",
    "site/src/features/moderation/components/verification-application-amend.tsx",
    "site/src/features/servers/components/managed-server-visibility-batch.tsx",
    "site/src/features/community/components/author-publication-restore.tsx",
    "site/src/features/community/components/discussion-report-batch.tsx",
    "site/src/features/notifications/components/notification-inbox.tsx",
    "site/src/features/accounts/components/settings-page-client.tsx",
    "site/src/features/accounts/components/verify-email-page.tsx",
    "site/src/features/accounts/components/reset-password-page.tsx",
    "site/src/features/accounts/components/forgot-password-page.tsx",
    "site/src/features/commerce/components/acquire-page.tsx",
    "site/src/features/support/components/support-center.tsx",
    "site/src/features/support/components/support-case-thread.tsx",
  ])("%s allowlists failure messages", (path) => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    expect(source).toContain("function safeMessage");
    expect(source).not.toMatch(
      /setError\(\s*(?:failure|caught) instanceof Error \? (?:failure|caught)\.message/,
    );
    expect(source).not.toMatch(
      /setError\(\s*caught instanceof Error && caught\.message \? caught\.message/,
    );
    expect(source).not.toMatch(/setReadError\(\s*caught instanceof Error \? caught\.message/);
    expect(source).not.toMatch(/setWriteError\(\s*caught instanceof Error \? caught\.message/);
    expect(source).not.toMatch(/onFailure\(\s*failure instanceof Error \? failure\.message/);
  });
});
