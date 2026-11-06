import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for context-switcher-unavailable notice. */
it("locks context-switcher-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/context-switcher.tsx"),
    "utf8",
  );
  expect(source).toContain('id="context-switcher-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="context-switcher-unavailable"[\s\S]*?title=\{error\}/u);
});
