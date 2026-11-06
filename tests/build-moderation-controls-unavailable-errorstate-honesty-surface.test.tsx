import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/build-moderation-controls.tsx"),
  "utf8",
);

/** Honesty lock for build moderation controls failure. */
it("locks build-moderation-controls-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="build-moderation-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="build-moderation-controls-unavailable"\s+title=\{error\}/u,
  );
});
