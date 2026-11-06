import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/content-comment-form.tsx"), "utf8");

/** Honesty lock for content comment form failure. */
it("locks content-comment-form-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="content-comment-form-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="content-comment-form-unavailable"\s+title=\{error\}/u);
});
