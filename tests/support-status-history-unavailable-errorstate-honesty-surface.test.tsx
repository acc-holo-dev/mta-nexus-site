import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for support-status-history-unavailable notice. */
it("locks support-status-history-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/support-status-history.tsx"),
    "utf8",
  );
  expect(source).toContain('id="support-status-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="support-status-history-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
