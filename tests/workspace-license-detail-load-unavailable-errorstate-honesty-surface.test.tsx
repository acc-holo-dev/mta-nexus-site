import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/licenses/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace license detail load failure. */
it("locks workspace-license-detail-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-license-detail-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-license-detail-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
