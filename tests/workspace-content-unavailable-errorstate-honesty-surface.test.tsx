import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-content-unavailable notice. */
it("locks workspace-content-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/content/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-content-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-content-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
