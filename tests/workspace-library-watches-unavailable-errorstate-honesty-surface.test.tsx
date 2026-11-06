import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-library-watches-unavailable notice. */
it("locks workspace-library-watches-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/library/watches/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-library-watches-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-library-watches-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
