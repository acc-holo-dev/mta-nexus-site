import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resources-unavailable notice. */
it("locks workspace-resources-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/resources/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-resources-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resources-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
