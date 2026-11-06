import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-saved-unavailable notice. */
it("locks workspace-saved-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/saved/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-saved-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-saved-unavailable"[\s\S]*?title=\{copy.pageError\}/u,
  );
});
