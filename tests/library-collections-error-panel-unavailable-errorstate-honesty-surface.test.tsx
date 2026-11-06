import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for library-collections-error-panel-unavailable notice. */
it("locks library-collections-error-panel-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/library-collections-error-panel.tsx"),
    "utf8",
  );
  expect(source).toContain('id="library-collections-error-panel-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collections-error-panel-unavailable"[\s\S]*?title=\{libraryCollectionError\(locale, code\)\}/u,
  );
});
