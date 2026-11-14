import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for publication readiness blocked/pending ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/features/resources/components/resource-publication-readiness-panel.tsx";

it("locks publication readiness blocked and pending notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain("publication-readiness-blocked-");
  expect(source).toContain("publication-readiness-pending-");
  expect(source).toMatch(/title=\{copy\.states\[item\.state\]\}/);
  expect(source).toMatch(
    /item\.state === "blocked" \|\| item\.state === "pending" \? \(\s*<ErrorState/u,
  );
  expect(source).not.toContain("text-warning");
  expect(source).not.toContain('blocked: "text-danger"');
});
