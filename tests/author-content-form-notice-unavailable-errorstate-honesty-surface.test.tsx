import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/author-content-form.tsx"), "utf8");

/** Honesty lock for author content form notice failure. */
it("locks author-content-form-notice-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="author-content-form-notice-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="author-content-form-notice-unavailable"[\s\S]*?title=\{notice\.text\}/u,
  );
});
