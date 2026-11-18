import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/moderation/components/verification-workspace.tsx"),
  "utf8",
);

it("routes unconfirmed verification submit intent through ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="verification-workspace-write-failed"');
  expect(source).toContain("title={writeError}");
  expect(source).toContain("description={copy.mutationUnavailable}");
  expect(source).toContain("copy.submissionUnconfirmed");
  expect(source).toMatch(
    /intent \? \(\s*<ErrorState\s+id="verification-workspace-submit-unconfirmed"\s+title=\{copy\.submissionUnconfirmed\}\s+description=\{dictionary\.errors\.formErrorHint\}\s*\/>/u,
  );
  expect(source).toContain('role="status" className="text-sm text-success"');
  expect(source).toContain("{copy.submitted}");
  expect(source).not.toContain('<p role="status">');
  expect(source).not.toContain('role="alert"');
});
