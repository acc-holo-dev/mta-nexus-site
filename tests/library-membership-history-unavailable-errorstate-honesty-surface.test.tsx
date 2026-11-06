import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for membership history detail-load unavailable notice. */
it("locks library membership history unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "library-membership-history-screen.tsx"), "utf8");
  expect(source).toContain('id="library-membership-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-membership-history-unavailable"\s+title=\{m\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{m.loadUnavailable}</p>');
});
