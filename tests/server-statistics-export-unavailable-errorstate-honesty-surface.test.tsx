import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for server-statistics-export-unavailable notice. */
it("locks server-statistics-export-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/server-statistics-export-button.tsx"),
    "utf8",
  );
  expect(source).toContain('id="server-statistics-export-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-statistics-export-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
