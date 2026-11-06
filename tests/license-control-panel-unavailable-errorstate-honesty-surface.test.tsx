import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for license-control-panel-unavailable notice. */
it("locks license-control-panel-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/license-control-panel.tsx"),
    "utf8",
  );
  expect(source).toContain('id="license-control-panel-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="license-control-panel-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
