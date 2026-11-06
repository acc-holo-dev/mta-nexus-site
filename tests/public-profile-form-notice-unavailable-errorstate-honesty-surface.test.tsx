import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/public-profile-form.tsx"), "utf8");

/** Honesty lock for public profile form notice failure. */
it("locks public-profile-form-notice-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="public-profile-form-notice-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="public-profile-form-notice-unavailable"[\s\S]*?title=\{notice\.text\}/u,
  );
});
