import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/commerce/components/commercial-plan-form.tsx"),
  "utf8",
);
const copy = readFileSync(join(root, "site/src/features/commerce/commercial-i18n.ts"), "utf8");

/** Honesty lock: commercial plan recovery/unknown-result copy stays dictionary-backed. */
it("locks commercial plan recovery and unknown-result strings to commercial-i18n", () => {
  expect(copy).toContain("resultUnknown:");
  expect(copy).toContain("checkedResult:");
  expect(copy).toContain("previousResultUnknown:");
  expect(copy).toContain("restoreFailed:");
  expect(source).toContain("copy.resultUnknown");
  expect(source).toContain("copy.checkedResult");
  expect(source).toContain("copy.previousResultUnknown");
  expect(source).toContain("copy.restoreFailed");
  expect(source).not.toContain("The operation result is unknown");
  expect(source).not.toContain("Я проверил результат");
});
