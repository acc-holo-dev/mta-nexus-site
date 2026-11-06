import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for context-publication-history-unavailable notice. */
it("locks context-publication-history-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/context-publication-history-screen.tsx"),
    "utf8",
  );
  expect(source).toContain('id="context-publication-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="context-publication-history-unavailable"\s+title=\{failure \|\| copy\.unavailable\}/u,
  );
});
