import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/library/downloads/page.tsx"),
  "utf8",
);

/** Honesty lock for library downloads non-downloadable notice. */
it("locks library download unavailable notice to ErrorState", () => {
  expect(source).toContain("ErrorState");
  expect(source).toMatch(
    /receipt\.downloadable \? \([\s\S]*?\) : \(\s*<ErrorState id="library-download-unavailable" title=\{copy\.unavailable\} \/>\s*\)/u,
  );
  expect(source).not.toContain('className="text-xs text-muted">{copy.unavailable}</p>');
});
