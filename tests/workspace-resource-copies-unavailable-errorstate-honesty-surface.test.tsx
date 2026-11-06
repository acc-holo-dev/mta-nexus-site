import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-copies-unavailable notice. */
it("locks workspace-resource-copies-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/copies/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-resource-copies-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-copies-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
});
