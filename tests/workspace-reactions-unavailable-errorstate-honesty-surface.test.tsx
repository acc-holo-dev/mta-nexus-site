import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-reactions-unavailable notice. */
it("locks workspace-reactions-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/reactions/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-reactions-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-reactions-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
