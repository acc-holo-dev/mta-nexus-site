import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for community report staff-forbidden notice. */
it("locks community report forbidden to ErrorState", () => {
  const source = readFileSync(join(root, "community-report-screen.tsx"), "utf8");
  expect(source).toContain('id="community-report-forbidden"');
  expect(source).toMatch(
    /<ErrorState\s+id="community-report-forbidden"\s+title=\{copy\.forbidden\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.forbidden}</p>');
});
