import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/components/content-discussion.tsx"),
  "utf8",
);

/** Honesty lock: identityUnavailable ≠ GuestAuthLinks for compose/report. */
it("locks ContentDiscussion identityUnavailable away from guest-lie CTAs", () => {
  expect(source).toContain("identityUnavailable = false");
  expect(source).toContain('id="discussion-identity-unavailable"');
  expect(source).toContain("copy.identityUnavailable");
  expect(source).toMatch(
    /identityUnavailable \? \([\s\S]*?<ErrorState[\s\S]*?\) : !viewer \? \([\s\S]*?<GuestAuthLinks/u,
  );
  expect(source).toContain("if (identityUnavailable)");
  expect(source).toContain("identityUnavailable || text.trim().length < 2");
  expect(source).toMatch(
    /identityUnavailable\s*\?\s*\{\s*(?:\/\/[^\n]*\n\s*)*authenticated:\s*null,/u,
  );
  expect(source).toMatch(/viewer\s*\?\s*undefined\s*:\s*\{\s*authenticated:\s*false,/u);
});
