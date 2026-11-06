import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for license-runtime-probe-unavailable notice. */
it("locks license-runtime-probe-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/license-runtime-probe.tsx"),
    "utf8",
  );
  expect(source).toContain('id="license-runtime-probe-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="license-runtime-probe-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
