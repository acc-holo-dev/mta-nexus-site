import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/servers/[id]/content/page.tsx"),
  "utf8",
);

/** Honesty lock for workspace server content failure. */
it("locks workspace-server-content-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="workspace-server-content-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-server-content-unavailable"\s+title=\{failure\}/u,
  );
});
