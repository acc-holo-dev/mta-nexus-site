import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/server-claim-control-panel.tsx"),
  "utf8",
);

/** Honesty lock for server claim control panel failure. */
it("locks server-claim-control-panel-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="server-claim-control-panel-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-claim-control-panel-unavailable"\s+title=\{error\}/u,
  );
});
