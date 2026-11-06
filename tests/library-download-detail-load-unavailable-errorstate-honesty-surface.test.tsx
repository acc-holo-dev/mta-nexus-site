import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/downloads/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for library download detail load failure. */
it("locks library-download-detail-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-download-detail-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-download-detail-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
