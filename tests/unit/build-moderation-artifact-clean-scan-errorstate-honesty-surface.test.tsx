import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/components/build-moderation-controls.tsx"),
  "utf8",
);

it("locks artifact clean-scan notice to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="build-moderation-artifact-clean-scan"');
  expect(source).toMatch(
    /!hasTrustedCleanScan \? \(\s*<ErrorState\s+id="build-moderation-artifact-clean-scan"\s+title=\{copy\.artifactRequiresCleanScan\}\s*\/>\s*\) : null/u,
  );
  expect(source).not.toContain("bg-warning-soft px-3 py-2 text-[11px] text-warning");
  expect(source).not.toContain(
    'className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--nexus-warning)]/20 bg-warning-soft px-3 py-2 text-[11px] text-warning"',
  );
});
