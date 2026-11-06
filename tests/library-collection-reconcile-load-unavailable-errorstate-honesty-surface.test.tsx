import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/collections/[id]/reconcile/page.tsx"),
  "utf8",
);

/** Honesty lock for library collection reconcile load failure. */
it("locks library-collection-reconcile-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-reconcile-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-reconcile-load-unavailable"\s+title=\{m\.reconcileLoadUnavailable\}/u,
  );
});
