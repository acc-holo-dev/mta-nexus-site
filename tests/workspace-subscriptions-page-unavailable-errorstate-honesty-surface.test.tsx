import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-subscriptions-page-unavailable notice. */
it("locks workspace-subscriptions-page-unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/subscriptions/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-subscriptions-page-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-subscriptions-page-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
});
