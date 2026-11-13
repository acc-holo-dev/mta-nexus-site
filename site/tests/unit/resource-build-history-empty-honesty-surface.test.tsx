import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks resource build history empty chrome to EmptyState", () => {
  const source = read("site/src/components/resource-build-screen.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain("copy.noHistory");
  expect(source).toContain("copy.history");
  expect(source).toContain("History");
  expect(source).not.toContain('<p className="text-secondary">{copy.noHistory}</p>');
});
