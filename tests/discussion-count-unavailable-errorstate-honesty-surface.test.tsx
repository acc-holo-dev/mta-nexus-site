import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/content-discussion.tsx"), "utf8");

/** Honesty lock for discussion countUnavailable notice. */
it("locks discussion countUnavailable to ErrorState", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="discussion-count-unavailable"');
  expect(source).toMatch(
    /displayCount !== null \? \(\s*` \(\$\{displayCount\}\)`\s*\) : \(\s*<ErrorState id="discussion-count-unavailable" title=\{copy\.countUnavailable\} \/>\s*\)/u,
  );
  expect(source).not.toContain(
    'className="ml-2 text-sm text-muted">{copy.countUnavailable}</span>',
  );
});
