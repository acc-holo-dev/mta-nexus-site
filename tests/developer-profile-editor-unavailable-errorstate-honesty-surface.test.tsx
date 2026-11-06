import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/developer-profile-editor.tsx"),
  "utf8",
);

/** Honesty lock for developer profile editor failure. */
it("locks developer-profile-editor-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="developer-profile-editor-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="developer-profile-editor-unavailable"\s+title=\{error\}/u,
  );
});
