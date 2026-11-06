import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-acquisitions-unavailable notice. */
it("locks workspace-acquisitions-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/acquisitions/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-acquisitions-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-acquisitions-unavailable"\s+title=\{copy\.historyLoadUnavailable\}/u,
  );
});
