import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/library-collection-reconcile.tsx"),
  "utf8",
);

/** Honesty lock for library collection reconcile action failure. */
it("locks library-collection-reconcile-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-reconcile-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-reconcile-unavailable"\s+title=\{error\}/u,
  );
});
