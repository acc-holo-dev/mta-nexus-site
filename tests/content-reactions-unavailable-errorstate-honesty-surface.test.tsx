import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/content-reactions.tsx"), "utf8");

/** Honesty lock for content reactions failure notice. */
it("locks content-reactions-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="content-reactions-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="content-reactions-unavailable"\s+title=\{message\}/u);
});
