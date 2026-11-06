import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for license history load-unavailable notice. */
it("locks license history unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "license-history-page.tsx"), "utf8");
  expect(source).toContain('id="license-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="license-history-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
