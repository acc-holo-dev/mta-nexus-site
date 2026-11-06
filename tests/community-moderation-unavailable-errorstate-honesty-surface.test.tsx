import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for community moderation session-load unavailable notice. */
it("locks community moderation unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "community-moderation-screen.tsx"), "utf8");
  expect(source).toContain('id="community-moderation-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="community-moderation-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.unavailable}</p>');
});
