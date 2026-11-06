import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/organizations/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace organization detail failure. */
it("locks workspace-organization-detail-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-organization-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-organization-detail-unavailable"\s+title=\{failure\}/u,
  );
});
