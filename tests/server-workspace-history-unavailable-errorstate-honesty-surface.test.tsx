import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for server-workspace-history-unavailable notice. */
it("locks server-workspace-history-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/server-workspace-history-screen.tsx"),
    "utf8",
  );
  expect(source).toContain('id="server-workspace-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-workspace-history-unavailable"\s+title=\{failure \|\| copy\.historyUnavailable\}/u,
  );
});
