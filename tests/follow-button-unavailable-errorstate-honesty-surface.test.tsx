import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/follow-button.tsx"), "utf8");

/** Honesty lock for follow button failure. */
it("locks follow-button-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="follow-button-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="follow-button-unavailable"[\s\S]*?title=\{message \|\| shared\.error\}/u,
  );
});
