import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/updates/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace library updates load failure. */
it("locks workspace-library-updates-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-library-updates-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-library-updates-unavailable"\s+title=\{copy\.updatesLoadUnavailable\}/u,
  );
});
