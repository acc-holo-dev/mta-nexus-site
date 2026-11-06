import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-library-page-unavailable notice. */
it("locks workspace-library-page-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/library/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-library-page-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-library-page-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
