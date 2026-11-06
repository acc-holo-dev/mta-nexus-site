import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/new-resource-form.tsx"), "utf8");

/** Honesty lock for new resource form failure. */
it("locks new-resource-form-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="new-resource-form-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="new-resource-form-unavailable"\s+title=\{error\}/u);
});
