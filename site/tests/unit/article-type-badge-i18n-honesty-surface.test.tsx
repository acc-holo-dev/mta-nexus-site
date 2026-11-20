import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/server/article-page.tsx"),
  "utf8",
);

/** Honesty lock: article type badge uses dictionary, not inline RU/EN literals. */
it("locks article type badge to getUserPlatformCopy without bilingual literals", () => {
  expect(source).toContain("getUserPlatformCopy(locale)[article.type]");
  expect(source).not.toContain('"Обзор"');
  expect(source).not.toContain('"Review"');
  expect(source).not.toMatch(/article\.type === "review"\s*\?/u);
});
