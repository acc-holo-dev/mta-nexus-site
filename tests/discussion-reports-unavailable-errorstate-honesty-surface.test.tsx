import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for discussion reports load-unavailable notice. */
it("locks discussion reports unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "discussion-reports-screen.tsx"), "utf8");
  expect(source).toContain('id="discussion-reports-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="discussion-reports-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
