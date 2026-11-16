import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/components/community-report-groups.tsx"),
  "utf8",
);

/** Honesty lock for community report unknown target notice. */
it("locks community report unknown target to ErrorState", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="community-report-unknown-target"');
  expect(source).toMatch(
    /!item\.target \? \(\s*<ErrorState id="community-report-unknown-target" title=\{copy\.unknown\} \/>\s*\) : null/u,
  );
  expect(source).not.toContain('className="text-xs text-muted">{copy.unknown}</p>');
});
