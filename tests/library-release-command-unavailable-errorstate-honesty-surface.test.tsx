import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for library-release-command-unavailable notice. */
it("locks library-release-command-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/library-release-command.tsx"),
    "utf8",
  );
  expect(source).toContain('id="library-release-command-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-release-command-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
