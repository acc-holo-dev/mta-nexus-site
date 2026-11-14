import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/app/workspace/library/downloads/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock for library download receipt non-downloadable notice. */
it("locks library download receipt unavailable notice to ErrorState", () => {
  expect(source).toContain('id="library-download-receipt-unavailable"');
  expect(source).toMatch(
    /receipt\.downloadable \? \([\s\S]*?\) : \(\s*<ErrorState id="library-download-receipt-unavailable" title=\{copy\.unavailable\} \/>\s*\)/u,
  );
  expect(source).not.toContain("<p>{copy.unavailable}</p>");
});
