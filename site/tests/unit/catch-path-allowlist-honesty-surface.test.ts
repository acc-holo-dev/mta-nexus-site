import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Waves 210–214: catch paths only surface allowlisted locale copy, not raw English markers. */
describe("catch-path allowlist honesty surface", () => {
  it.each([
    "site/src/features/organizations/components/organization-team-directory.tsx",
    "site/src/features/organizations/components/organization-team-batch.tsx",
    "site/src/features/community/components/follow-workspace.tsx",
    "site/src/features/community/components/discussion-comment-actions.tsx",
    "site/src/features/community/components/moderated-discussion-removal.tsx",
  ])("%s allowlists failure messages", (path) => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    expect(source).toContain("Object.values");
    expect(source).not.toMatch(/setError\(\s*failure instanceof Error \? failure\.message/);
    expect(source).not.toMatch(/onFailure\(\s*failure instanceof Error \? failure\.message/);
  });
});
