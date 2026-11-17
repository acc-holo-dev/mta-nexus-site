import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/commerce/components/subscription-recovery.tsx"),
  "utf8",
);
const copy = readFileSync(join(root, "site/src/features/commerce/subscriptions-i18n.ts"), "utf8");

/** Honesty lock: subscription recovery headings use subscriptionsCopy. */
it("locks subscription recovery copy to subscriptions-i18n", () => {
  expect(copy).toContain("recoverTitle:");
  expect(copy).toContain("recoverDescription:");
  expect(source).toContain("subscriptionsCopy");
  expect(source).toContain("{copy.recoverTitle}");
  expect(source).toContain("{copy.recoverDescription}");
  expect(source).not.toContain("Recover subscription operation");
  expect(source).not.toContain("Восстановление операции подписки");
});
