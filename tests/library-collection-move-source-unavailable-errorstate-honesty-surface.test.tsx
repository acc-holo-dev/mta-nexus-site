import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/library-collection-item-copy.tsx"),
  "utf8",
);

/** Honesty lock for inactive/max-revision move-source notice. */
it("locks library collection move-source unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-move-source-unavailable"');
  expect(source).toMatch(
    /move && \(source\.status !== "active" \|\| source\.revision >= 2147483647\)\)\s*return \(\s*<ErrorState id="library-collection-move-source-unavailable" title=\{c\.moveSourceUnavailable\} \/>\s*\);/u,
  );
  expect(source).not.toContain('<p role="note">{c.moveSourceUnavailable}</p>');
});
