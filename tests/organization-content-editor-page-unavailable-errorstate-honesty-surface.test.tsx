import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/organization-content-editor-page.tsx"),
  "utf8",
);

/** Honesty lock for organization content editor page failure. */
it("locks organization-content-editor-page-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="organization-content-editor-page-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="organization-content-editor-page-unavailable"\s+title=\{failure\}/u,
  );
});
