import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/verification-moderation-controls.tsx"),
  "utf8",
);

/** Honesty lock for verification moderation decision failure. */
it("locks verification-moderation-controls-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="verification-moderation-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="verification-moderation-controls-unavailable"\s+title=\{error\}/u,
  );
});
