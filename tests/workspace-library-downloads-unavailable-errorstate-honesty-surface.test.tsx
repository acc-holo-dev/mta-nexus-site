import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-library-downloads-unavailable notice. */
it("locks workspace-library-downloads-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/library/downloads/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-library-downloads-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-library-downloads-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
