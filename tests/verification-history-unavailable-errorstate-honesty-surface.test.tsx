import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/verification/history/page.tsx"),
  "utf8",
);

/** Honesty lock for verification history load failure. */
it("locks verification-history-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="verification-history-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="verification-history-unavailable"\s+title=\{error\}/u);
});
