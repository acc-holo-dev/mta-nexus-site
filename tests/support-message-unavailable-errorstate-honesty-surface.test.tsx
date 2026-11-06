import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/support-message-page.tsx"), "utf8");

/** Honesty lock for support message page load failure. */
it("locks support-message-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="support-message-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="support-message-unavailable"[\s\S]*?title=\{\s*supportMessageError\(/u,
  );
});
