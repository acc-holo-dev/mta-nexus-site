import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-licenses-unavailable notice. */
it("locks workspace-licenses-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/licenses/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-licenses-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-licenses-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
