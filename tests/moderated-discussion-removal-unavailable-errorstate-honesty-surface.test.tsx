import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/moderated-discussion-removal.tsx"),
  "utf8",
);

/** Honesty lock for moderated discussion removal failure. */
it("locks moderated-discussion-removal-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="moderated-discussion-removal-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="moderated-discussion-removal-unavailable"\s+title=\{error\}/u,
  );
});
