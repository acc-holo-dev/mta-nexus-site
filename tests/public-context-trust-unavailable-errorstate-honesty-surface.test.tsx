import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for public-context-trust-unavailable notice. */
it("locks public-context-trust-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/public-context-trust-page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="public-context-trust-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="public-context-trust-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
