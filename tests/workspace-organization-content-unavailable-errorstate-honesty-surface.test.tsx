import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/organizations/[id]/content/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace organization content failure. */
it("locks workspace-organization-content-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-organization-content-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-organization-content-unavailable"\s+title=\{failure\}/u,
  );
});
