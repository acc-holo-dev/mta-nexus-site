import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-media-editor.tsx"),
  "utf8",
);

/** Honesty lock for resource media editor failure. */
it("locks resource-media-editor-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="resource-media-editor-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="resource-media-editor-unavailable"\s+title=\{error\}/u);
});
