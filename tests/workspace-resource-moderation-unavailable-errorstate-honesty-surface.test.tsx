import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-moderation-unavailable notice. */
it("locks workspace-resource-moderation-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/moderation/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-resource-moderation-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-moderation-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
