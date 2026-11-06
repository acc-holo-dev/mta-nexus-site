import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-history-unavailable notice. */
it("locks workspace-resource-history-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/history/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-resource-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-history-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
