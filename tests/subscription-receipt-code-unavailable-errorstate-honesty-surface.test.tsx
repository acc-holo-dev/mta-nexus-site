import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/subscriptions/receipts/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for subscription receipt coded error. */
it("locks subscription-receipt-code-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="subscription-receipt-code-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="subscription-receipt-code-unavailable"\s+title=\{subscriptionError\(locale, error\.code\)\}/u,
  );
});
