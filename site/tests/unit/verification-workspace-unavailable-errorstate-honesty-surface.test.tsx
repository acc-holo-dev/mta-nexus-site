import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const workspace = readFileSync(
  join(root, "site/src/components/verification-workspace.tsx"),
  "utf8",
);
const page = readFileSync(join(root, "site/src/app/workspace/verification/page.tsx"), "utf8");

/** Honesty lock: verification workspace unavailable fallback → ErrorState with stable id. */
it("locks verification workspace unavailable notices to ErrorState with stable id", () => {
  expect(workspace).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(workspace).toContain('id="verification-workspace-unavailable"');
  expect(workspace).toContain(
    'return <ErrorState id="verification-workspace-unavailable" title={copy.unavailable} />;',
  );
  expect(workspace).toMatch(
    /readError \? \(\s*<ErrorState\s+id="verification-workspace-unavailable"\s+title=\{readError\}/u,
  );
  expect(page).toContain('import { ErrorState } from "@nexus/ui"');
  expect(page).toContain('id="verification-workspace-unavailable"');
  expect(page).toMatch(
    /<ErrorState\s+id="verification-workspace-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
});
