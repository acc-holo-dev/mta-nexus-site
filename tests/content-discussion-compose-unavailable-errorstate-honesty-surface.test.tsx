import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for content-discussion-compose-unavailable notice. */
it("locks content-discussion-compose-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/content-discussion-compose-feedback.tsx"),
    "utf8",
  );
  expect(source).toContain('id="content-discussion-compose-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="content-discussion-compose-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
