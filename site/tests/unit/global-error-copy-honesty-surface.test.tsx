import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  detectGlobalErrorLocale,
  globalErrorCopy,
} from "../../src/features/shell/global-error-copy";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks global-error to Shell bilingual copy port without inline locale dictionaries", () => {
  const port = read("site/src/features/shell/global-error-copy.ts");
  expect(port).toContain("export function globalErrorCopy");
  expect(port).toContain("export function detectGlobalErrorLocale");
  expect(port).toContain("MTA NEXUS could not start");
  expect(port).toContain("Не удалось запустить MTA NEXUS");

  const page = read("site/src/app/global-error.tsx");
  expect(page).toContain('from "../features/shell/global-error-copy"');
  expect(page).toContain("globalErrorCopy");
  expect(page).toContain("detectGlobalErrorLocale");
  expect(page).not.toContain("const copy = {");
  expect(page).toContain("MTA NEXUS");
});

it("resolves RU/EN global-error copy and locale cookie detection", () => {
  expect(detectGlobalErrorLocale("nexus_locale=ru")).toBe("ru");
  expect(detectGlobalErrorLocale("nexus_locale=en")).toBe("en");
  expect(globalErrorCopy("en").retry).toBe("Try again");
  expect(globalErrorCopy("ru").retry).toBe("Повторить");
});
