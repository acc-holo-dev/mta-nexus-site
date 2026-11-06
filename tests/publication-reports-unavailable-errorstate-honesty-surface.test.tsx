import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/publication-reports-page.tsx"),
  "utf8",
);

/** Honesty lock for publication reports load failure. */
it("locks publication-reports-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="publication-reports-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="publication-reports-unavailable"[\s\S]*?title=\{\s*communityReportError\(/u,
  );
});
