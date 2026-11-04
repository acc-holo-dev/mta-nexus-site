import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { resourceMediaCopy } from "../apps/web/src/lib/resource-media-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

it("gates gallery image removal behind confirmAction with localized copy", () => {
  const source = read("apps/web/src/components/resource-media-editor.tsx");
  const i18n = read("apps/web/src/lib/resource-media-i18n.ts");

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
