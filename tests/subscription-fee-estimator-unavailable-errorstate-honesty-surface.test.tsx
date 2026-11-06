import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for subscription-fee-estimator-unavailable notice. */
it("locks subscription-fee-estimator-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/subscription-fee-estimator.tsx"),
    "utf8",
  );
  expect(source).toContain('id="subscription-fee-estimator-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="subscription-fee-estimator-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
