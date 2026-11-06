import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for content-moderation-controls-unavailable notice. */
it("locks content-moderation-controls-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/content-moderation-controls.tsx"),
    "utf8",
  );
  expect(source).toContain('id="content-moderation-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="content-moderation-controls-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
