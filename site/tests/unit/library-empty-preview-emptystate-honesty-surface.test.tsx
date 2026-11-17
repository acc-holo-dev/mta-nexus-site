import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks library empty import preview and empty item-copy to EmptyState with hints", () => {
  const itemCopy = read("site/src/features/library/components/library-collection-item-copy.tsx");
  expect(itemCopy).toContain("EmptyState");
  expect(itemCopy).toContain("c.emptyItems");
  expect(itemCopy).toContain("c.emptyItemsHint");
  expect(itemCopy).not.toMatch(/return <p>\{c\.emptyItems\}<\/p>/u);

  const importView = read("site/src/features/library/components/library-collection-import.tsx");
  expect(importView).toContain("EmptyState");
  expect(importView).toContain("m.empty");
  expect(importView).toContain("m.emptyHint");
  expect(importView).not.toMatch(/!preview\.items\.length && <p>\{m\.empty\}<\/p>/u);

  const manifests = read("site/src/features/library/library-collection-manifests-i18n.ts");
  expect(manifests).toContain("emptyHint:");
});
