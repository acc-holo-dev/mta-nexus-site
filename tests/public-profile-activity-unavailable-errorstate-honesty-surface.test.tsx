import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for public profile activity load-unavailable notice. */
it("locks public profile activity unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "public-profile-activity.tsx"), "utf8");
  expect(source).toContain('id="public-profile-activity-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="public-profile-activity-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
