import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/library/components/library-collection-item-copy.tsx"),
  "utf8",
);

/** Honesty lock: inactive/max-revision move-source notice must use ErrorState. */
it("locks library collection move-source unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-collection-move-source-unavailable"');
  expect(source).toContain('id="library-collection-move-source-unavailable"');
  expect(source).toContain("title={c.moveSourceUnavailable}");
  expect(source).toContain("description={c.moveSourceUnavailableHint}");
  expect(source).toMatch(
    /move && \(source\.status !== "active" \|\| source\.revision >= 2147483647\)/u,
  );
  expect(source).not.toContain('<p role="note">{c.moveSourceUnavailable}</p>');
});
