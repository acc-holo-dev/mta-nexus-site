import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/components/content-discussion.tsx"),
  "utf8",
);

/** Honesty lock for discussion countUnavailable notice. */
it("locks discussion countUnavailable to ErrorState", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="discussion-count-unavailable"');
  expect(source).toContain("title={copy.countUnavailable}");
  expect(source).toContain("description={copy.countUnavailableHint}");
  expect(source).toMatch(
    /displayCount !== null \? \(\s*` \(\$\{displayCount\}\)`\s*\) : \(\s*<ErrorState[\s\S]*?id="discussion-count-unavailable"/u,
  );
  expect(source).not.toContain(
    'className="ml-2 text-sm text-muted">{copy.countUnavailable}</span>',
  );
});
