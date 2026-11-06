import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for build-quarantine-controls-unavailable notice. */
it("locks build-quarantine-controls-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/build-quarantine-controls.tsx"),
    "utf8",
  );
  expect(source).toContain('id="build-quarantine-controls-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="build-quarantine-controls-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
