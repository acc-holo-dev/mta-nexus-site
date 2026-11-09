import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for library collection item unavailableNote ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/library-collections-detail-view.tsx";

it("locks collection item unavailableNote to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="library-collection-item-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="library-collection-item-unavailable" title=\{c\.unavailableNote\}/,
  );
  expect(source).not.toContain('className="text-sm text-muted">{c.unavailableNote}</p>');
});
