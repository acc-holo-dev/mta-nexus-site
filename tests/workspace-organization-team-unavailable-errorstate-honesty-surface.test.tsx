import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/organizations/[id]/team/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace organization team failure. */
it("locks workspace-organization-team-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-organization-team-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-organization-team-unavailable"\s+title=\{error\}/u,
  );
});
