import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/server-observation-browser-page.tsx"),
  "utf8",
);

/** Honesty lock for server observation browser load failure. */
it("locks server-observation-browser-page-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="server-observation-browser-page-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-observation-browser-page-unavailable"\s+title=\{text\}/u,
  );
});
