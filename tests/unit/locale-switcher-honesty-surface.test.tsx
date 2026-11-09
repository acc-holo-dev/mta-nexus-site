import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks locale switcher CTA to size=touch / min-h-11 without size=sm", () => {
  const source = read("apps/web/src/components/locale-switcher.tsx");
  expect(source).toContain('size="touch"');
  expect(source).toContain("min-h-11");
  expect(source).toMatch(/min-h-11|size="touch"/u);
  expect(source).not.toContain('size="sm"');
  expect(source).not.toContain("min-h-10");
});
