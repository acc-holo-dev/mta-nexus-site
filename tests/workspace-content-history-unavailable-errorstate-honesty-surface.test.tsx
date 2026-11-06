import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/content/[id]/history/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace content history load failure. */
it("locks workspace-content-history-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-content-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-content-history-unavailable"\s+title=\{error\}/u,
  );
});
