import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-feed-unavailable notice. */
it("locks workspace-feed-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/feed/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-feed-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-feed-unavailable"[\s\S]*?title=\{copy.error\}/u,
  );
});
