import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for profile-change-history-unavailable notice. */
it("locks profile-change-history-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/profile-change-history.tsx"),
    "utf8",
  );
  expect(source).toContain('id="profile-change-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="profile-change-history-unavailable"\s+title=\{error \?\? copy\.unavailable\}/u,
  );
});
