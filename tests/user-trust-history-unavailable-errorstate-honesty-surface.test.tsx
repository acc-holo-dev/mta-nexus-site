import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/users/[username]/trust/history/page.tsx"),
  "utf8",
);

/** Honesty lock for user trust history load failure. */
it("locks user-trust-history-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="user-trust-history-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="user-trust-history-unavailable"\s+title=\{error\}/u);
});
