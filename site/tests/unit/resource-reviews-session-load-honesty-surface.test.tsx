import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks public reviews session probe failure away from pageUnavailable and guest CTAs", () => {
  const source = read("site/src/features/resources/server/reviews-page.tsx");
  expect(source).toContain("sessionFailed");
  expect(source).toContain('id="resource-reviews-session-unavailable"');
  expect(source).toContain("copy.sessionUnavailable");
  expect(source).toContain("copy.sessionUnavailableDescription");
  expect(source).not.toMatch(/sessionFailed \?\s*\([\s\S]*?title=\{copy\.pageUnavailable\}/u);
  expect(source).toContain("copy.pageUnavailableDescription");
});

it("locks review session and pageUnavailable copy keys in both locales", () => {
  const source = read("site/src/features/resources/resource-review-i18n.ts");
  expect(source).toContain("sessionUnavailable:");
  expect(source).toContain("sessionUnavailableDescription:");
  expect(source).toContain("pageUnavailableDescription:");
});
