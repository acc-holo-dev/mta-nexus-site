import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-discussions-unavailable notice. */
it("locks workspace-discussions-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/discussions/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-discussions-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-discussions-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
