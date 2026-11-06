import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/server-details-form.tsx"), "utf8");

/** Honesty lock for server details form notice failure. */
it("locks server-details-form-notice-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="server-details-form-notice-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-details-form-notice-unavailable"[\s\S]*?title=\{notice\.text\}/u,
  );
});
