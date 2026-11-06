import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/app");

/** Honesty lock for market catalog load-unavailable notice. */
it("locks market catalog unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "market/page.tsx"), "utf8");
  expect(source).toContain('id="market-catalog-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="market-catalog-unavailable"\s+title=\{dictionary\.market\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{dictionary.market.loadUnavailable}</p>');
});
