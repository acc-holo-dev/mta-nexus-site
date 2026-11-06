import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for subscriptions catalog load-unavailable notice. */
it("locks subscriptions unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/subscriptions/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="subscriptions-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="subscriptions-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
