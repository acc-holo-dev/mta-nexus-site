import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/app");

/** Honesty lock for community index unavailable notice. */
it("locks community unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "community/page.tsx"), "utf8");
  expect(source).toContain('id="community-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="community-unavailable"\s+title=\{platformCopy\.unavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{platformCopy.unavailable}</p>');
});
