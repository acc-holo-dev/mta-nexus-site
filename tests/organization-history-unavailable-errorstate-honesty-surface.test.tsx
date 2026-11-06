import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for organization-history-unavailable notice. */
it("locks organization-history-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/organization-history.tsx"),
    "utf8",
  );
  expect(source).toContain('id="organization-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="organization-history-unavailable"\s+title=\{error \?\? copy\.unavailable\}/u,
  );
});
