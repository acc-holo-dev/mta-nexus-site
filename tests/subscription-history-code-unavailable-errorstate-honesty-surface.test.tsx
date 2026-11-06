import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/subscriptions/history/page.tsx"),
  "utf8",
);

/** Honesty lock for subscription history coded error. */
it("locks subscription-history-code-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="subscription-history-code-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="subscription-history-code-unavailable"\s+title=\{subscriptionError\(locale, error\.code\)\}/u,
  );
});
