import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "apps/web/src/app/workspace/verification/[id]/page.tsx"),
  "utf8",
);

/** Honesty lock: verification application soft muted readonly → ErrorState alert. */
it("locks verification application readonly notice to ErrorState without soft muted caption", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="verification-application-readonly"');
  expect(source).toMatch(
    /\{application\.editable \? \(\s*<VerificationApplicationAmend[\s\S]*?\) : \(\s*<ErrorState id="verification-application-readonly" title=\{copy\.readOnly\} \/>\s*\)\}/u,
  );
  expect(source).not.toContain('className="text-sm text-muted">{copy.readOnly}</p>');
});
