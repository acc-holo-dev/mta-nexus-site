import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "site/src/app/workspace/library/downloads/page.tsx"),
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
