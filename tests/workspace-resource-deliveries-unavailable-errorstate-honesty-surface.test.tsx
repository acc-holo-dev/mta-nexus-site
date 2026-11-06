import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-deliveries-unavailable notice. */
it("locks workspace-resource-deliveries-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/deliveries/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-resource-deliveries-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-deliveries-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
