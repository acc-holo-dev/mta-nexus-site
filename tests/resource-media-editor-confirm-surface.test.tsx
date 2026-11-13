import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { resourceMediaCopy } from "../site/src/lib/resource-media-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

it("gates gallery image removal behind confirmAction with localized copy", () => {
  const source = read("site/src/components/resource-media-editor.tsx");
  const i18n = read("site/src/lib/resource-media-i18n.ts");

  expect(source).toContain('import { confirmAction } from "./confirm-action"');
  expect(source).toContain("copy.removeConfirmTitle");
  expect(source).toContain("copy.removeConfirm");
  expect(source).toContain("danger: true");
  expect(source).toContain("void removeItem(item)");
  expect(source).not.toContain("setRemoving");
  expect(source).not.toContain("removing ===");

  const confirmAt = source.indexOf("copy.removeConfirmTitle");
  const mutateAt = source.indexOf('action: "remove"');
  expect(confirmAt).toBeGreaterThan(-1);
  expect(mutateAt).toBeGreaterThan(confirmAt);

  const en = resourceMediaCopy("en");
  const ru = resourceMediaCopy("ru");
  expect(en.removeConfirmTitle).not.toBe(ru.removeConfirmTitle);
  expect(en.removeConfirm).not.toBe(ru.removeConfirm);
  expect(en.confirm).not.toBe(ru.confirm);
  expect(en.cancel).not.toBe(ru.cancel);
  expect(i18n).toContain("removeConfirmTitle");
  expect(i18n).toContain("removeConfirm:");
});

it("locks gallery cover/up/down/remove controls to size=touch min-h-11 chrome", () => {
  const source = read("site/src/components/resource-media-editor.tsx");
  expect(source).toContain("EmptyState");
  expect(source).not.toContain('size="sm"');
  expect(source).not.toContain("min-h-10");
  for (const label of ["copy.cover", "copy.up", "copy.down", "copy.remove"] as const) {
    expect(source).toContain(label);
  }
  const reorderBlock = source.slice(
    source.indexOf("{!readonly && ("),
    source.indexOf("{dirty && ("),
  );
  expect(reorderBlock.match(/size="touch"/gu)?.length ?? 0).toBe(4);
  expect(reorderBlock).toMatch(/onClick=\{\(\) => move\(index, 0\)\}/u);
  expect(reorderBlock).toMatch(/onClick=\{\(\) => void removeItem\(item\)\}/u);
});
