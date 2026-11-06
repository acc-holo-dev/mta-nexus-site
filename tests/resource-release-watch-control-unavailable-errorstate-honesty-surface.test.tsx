import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-release-watch-control.tsx"),
  "utf8",
);

/** Honesty lock for resource release watch control failure. */
it("locks resource-release-watch-control-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="resource-release-watch-control-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-release-watch-control-unavailable"\s+title=\{error\}/u,
  );
});
