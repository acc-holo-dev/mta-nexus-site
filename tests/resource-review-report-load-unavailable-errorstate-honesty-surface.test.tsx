import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for resource review report load-unavailable notice. */
it("locks resource review report load unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "resource-review-report-screen.tsx"), "utf8");
  expect(source).toContain('id="resource-review-report-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-review-report-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
