import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-compatibility-unavailable notice. */
it("locks workspace-resource-compatibility-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/compatibility/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-resource-compatibility-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-compatibility-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
