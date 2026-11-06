import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for market versions product-load unavailable notice. */
it("locks market versions unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/market/[slug]/versions/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="market-versions-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="market-versions-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
