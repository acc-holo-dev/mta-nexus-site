import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/managed-server-visibility-batch.tsx"),
  "utf8",
);

/** Honesty lock for managed server visibility batch failure. */
it("locks managed-server-visibility-batch-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="managed-server-visibility-batch-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="managed-server-visibility-batch-unavailable"\s+title=\{error\}/u,
  );
});
