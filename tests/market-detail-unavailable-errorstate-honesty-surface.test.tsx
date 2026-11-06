import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for market product detail load-unavailable notice. */
it("locks market detail unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/market/[slug]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="market-detail-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="market-detail-unavailable"\s+title=\{copy\.detailUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.detailUnavailable}</p>');
});
