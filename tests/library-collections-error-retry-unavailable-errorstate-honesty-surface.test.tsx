import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/error.tsx"),
  "utf8",
);

/** Honesty lock for library collections error boundary retry. */
it("locks library-collections-error-retry-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collections-error-retry-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collections-error-retry-unavailable"\s+title=\{c\.retry\}/u,
  );
});
