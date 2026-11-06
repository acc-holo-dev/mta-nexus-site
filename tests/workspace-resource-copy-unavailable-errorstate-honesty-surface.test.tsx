import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-copy-unavailable notice. */
it("locks workspace-resource-copy-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/copy/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-resource-copy-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-copy-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
});
