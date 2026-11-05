import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/order-case-forms.tsx"), "utf8");

/** Honesty lock for order-case refund recommendation blocked notice. */
it("locks recommendationBlocked notice to ErrorState without soft secondary text", () => {
  expect(source).toContain('import { Button, ErrorState, fieldClassBlock } from "@nexus/ui"');
  expect(source).toMatch(
    /canRecommendRefund && monetary && !recommendationEligible && \(\s*<ErrorState id="order-case-recommendation-blocked" title=\{copy\.recommendationBlocked\} \/>\s*\)/u,
  );
  expect(source).not.toContain(
    'className="text-sm text-secondary">{copy.recommendationBlocked}</p>',
  );
});
