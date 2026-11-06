import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for market reviews page load-unavailable notice. */
it("locks market reviews unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/market/[slug]/reviews/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="market-reviews-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="market-reviews-unavailable"\s+title=\{copy\.pageUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.pageUnavailable}</p>');
});
