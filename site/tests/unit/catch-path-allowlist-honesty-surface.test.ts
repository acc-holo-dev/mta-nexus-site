import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Waves 210–214 / 218–225: catch paths only surface allowlisted locale copy. */
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
  ])("%s allowlists failure messages", (path) => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    expect(source).toContain("function safeMessage");
    expect(source).not.toMatch(
      /setError\(\s*(?:failure|caught) instanceof Error \? (?:failure|caught)\.message/,
    );
    expect(source).not.toMatch(/setReadError\(\s*caught instanceof Error \? caught\.message/);
    expect(source).not.toMatch(/setWriteError\(\s*caught instanceof Error \? caught\.message/);
    expect(source).not.toMatch(/onFailure\(\s*failure instanceof Error \? failure\.message/);
  });
});
