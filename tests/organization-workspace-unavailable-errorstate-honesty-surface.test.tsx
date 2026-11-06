import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/organization-workspace.tsx"),
  "utf8",
);

/** Honesty lock for organization workspace failure. */
it("locks organization-workspace-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="organization-workspace-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="organization-workspace-unavailable"\s+title=\{error\}/u,
  );
});
