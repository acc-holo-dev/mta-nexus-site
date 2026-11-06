import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for server statistics session-load unavailable notice. */
it("locks server statistics unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "server-statistics-page.tsx"), "utf8");
  expect(source).toContain('id="server-statistics-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-statistics-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.unavailable}</p>');
});
