import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const filterSurfaces = [
  "apps/web/src/components/library-collections-detail-view.tsx",
  "apps/web/src/components/library-collections-item-transfer-view.tsx",
] as const;

it("exposes search landmarks, EmptyState, and touch-sized filter inputs on collection detail and transfer", () => {
  for (const path of filterSurfaces) {
    const source = read(path);
    expect(source).toContain("<search aria-label={c.search}>");
    expect(source).toContain("EmptyState");
    expect(source).toContain("emptyFilteredItems");
    expect(source).toContain("emptyItems");
    expect(source).toContain("emptyItemsHint");
    expect(source).toContain("min-h-11");
    expect(source).not.toMatch(
      /<p>\s*\{result\.q \? c\.emptyFilteredItems : c\.emptyItems\}\s*<\/p>/u,
    );
    expect(source).not.toContain('role="status" aria-live="polite"');
  }
});
