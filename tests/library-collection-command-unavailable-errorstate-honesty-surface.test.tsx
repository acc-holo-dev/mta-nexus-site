import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for library-collection-command-unavailable notice. */
it("locks library-collection-command-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/library-collection-command.tsx"),
    "utf8",
  );
  expect(source).toContain('id="library-collection-command-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-command-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
