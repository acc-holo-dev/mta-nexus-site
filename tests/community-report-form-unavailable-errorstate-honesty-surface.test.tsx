import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/community-report-form.tsx"),
  "utf8",
);

/** Honesty lock for community report form failure. */
it("locks community-report-form-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="community-report-form-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="community-report-form-unavailable"\s+title=\{error\}/u);
});
