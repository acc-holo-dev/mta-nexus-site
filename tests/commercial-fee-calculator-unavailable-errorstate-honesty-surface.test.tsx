import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for commercial-fee-calculator-unavailable notice. */
it("locks commercial-fee-calculator-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/commercial-fee-calculator.tsx"),
    "utf8",
  );
  expect(source).toContain('id="commercial-fee-calculator-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="commercial-fee-calculator-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
