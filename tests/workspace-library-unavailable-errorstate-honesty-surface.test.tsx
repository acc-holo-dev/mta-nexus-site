import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace hub library-unavailable notice. */
it("locks workspace library unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/workspace/page.tsx"), "utf8");
  expect(source).toContain('id="workspace-library-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-library-unavailable"\s+title=\{dictionary\.workspace\.libraryUnavailable\}/u,
  );
  expect(source).not.toContain(
    'className="text-danger">{dictionary.workspace.libraryUnavailable}</p>',
  );
});
