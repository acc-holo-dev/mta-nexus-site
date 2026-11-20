import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: commerce recovery restore/save failures stay dictionary-backed. */
it("locks subscription-controls recovery strings to subscriptions-i18n", () => {
  const source = read("site/src/features/commerce/components/subscription-controls.tsx");
  const copy = read("site/src/features/commerce/subscriptions-i18n.ts");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("recoverySaveFailed:");
  expect(source).toContain("c.restoreFailed");
  expect(source).toContain("c.recoverySaveFailed");
  expect(source).not.toContain("Could not verify the session or restore the request.");
  expect(source).not.toContain("Не удалось сохранить данные восстановления. Запрос не отправлен.");
});

it("locks plan-review-form recovery strings to plan-reviews-i18n", () => {
  const source = read("site/src/features/commerce/components/plan-review-form.tsx");
  const copy = read("site/src/features/commerce/plan-reviews-i18n.ts");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("recoverySaveFailed:");
  expect(source).toContain(".restoreFailed");
  expect(source).toContain("c.recoverySaveFailed");
  expect(source).not.toContain("Could not verify the session or restore the selection.");
  expect(source).not.toContain("Не удалось сохранить данные восстановления. Обзор не отправлен.");
});
