import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/app/auth/forgot-password/page.tsx"), "utf8");

/** Honesty lock for forgot password notice failure. */
it("locks forgot-password-notice-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="forgot-password-notice-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="forgot-password-notice-unavailable"\s+title=\{notice\.text\}/u,
  );
});
