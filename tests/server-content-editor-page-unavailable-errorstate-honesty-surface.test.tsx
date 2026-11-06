import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/server-content-editor-page.tsx"),
  "utf8",
);

/** Honesty lock for server content editor page failure. */
it("locks server-content-editor-page-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="server-content-editor-page-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-content-editor-page-unavailable"\s+title=\{failure\}/u,
  );
});
