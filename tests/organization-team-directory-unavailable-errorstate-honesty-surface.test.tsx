import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/organization-team-directory.tsx"),
  "utf8",
);

/** Honesty lock for organization team directory failure. */
it("locks organization-team-directory-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="organization-team-directory-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="organization-team-directory-unavailable"[\s\S]*?title=\{error \|\| copy\.uncertain\}/u,
  );
});
