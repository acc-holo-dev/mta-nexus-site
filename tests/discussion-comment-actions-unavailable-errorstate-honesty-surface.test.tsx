import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/discussion-comment-actions.tsx"),
  "utf8",
);

/** Honesty lock for discussion comment actions failure. */
it("locks discussion-comment-actions-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="discussion-comment-actions-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="discussion-comment-actions-unavailable"[\s\S]*?title=\{stale \? copy\.changed : error\}/u,
  );
});
