import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/verification/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace verification detail unavailable. */
it("locks workspace-verification-detail-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-verification-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-verification-detail-unavailable"\s+title=\{labels\.unavailable\}/u,
  );
});
