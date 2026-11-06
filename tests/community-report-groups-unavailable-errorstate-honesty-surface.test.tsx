import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/community-report-groups-page.tsx"),
  "utf8",
);

/** Honesty lock for community report groups load failure. */
it("locks community-report-groups-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="community-report-groups-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="community-report-groups-unavailable"[\s\S]*?title=\{\s*reportGroupsError\(/u,
  );
});
