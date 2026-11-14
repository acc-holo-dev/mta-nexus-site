import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/server/resource-review-report-screen.tsx"),
  "utf8",
);

/** Honesty lock for missing resource-review report review notice. */
it("locks resource-review report unavailable notice to ErrorState", () => {
  expect(source).toContain('id="resource-review-report-unavailable"');
  expect(source).toMatch(
    /report\.review \? \([\s\S]*?\) : \(\s*<ErrorState id="resource-review-report-unavailable" title=\{copy\.unavailable\} \/>\s*\)/u,
  );
  expect(source).not.toContain("<p>{copy.unavailable}</p>");
});
