import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/discussions/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace discussion detail failure. */
it("locks workspace-discussion-detail-failed notice to ErrorState", () => {
  expect(source).toContain('id="workspace-discussion-detail-failed"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-discussion-detail-failed"\s+title=\{copy\.failed\}/u,
  );
});
