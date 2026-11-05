import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const filterSurfaces = [
  "apps/web/src/components/collection-releases-screen.tsx",
  "apps/web/src/app/workspace/library/collections/resources/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/compare/page.tsx",
] as const;

it("exposes search landmarks and touch-sized filter inputs on residual library filters", () => {
  for (const path of filterSurfaces) {
    const source = read(path);
    expect(source, path).toMatch(/<search aria-label=\{(?:cc|v|c)\.search\}>/u);
    expect(source, path).toContain('name="q"');
    expect(source, path).toContain("min-h-11");
  }
});
