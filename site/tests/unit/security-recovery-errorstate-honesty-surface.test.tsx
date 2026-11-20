import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/accounts/server/security-center-screen.tsx"),
  "utf8",
);

/** Honesty lock for security-center recovery unavailable / needs-verification notices. */
it("locks security recovery unavailable and needs-verification to ErrorState", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="security-recovery-needs-verification"');
  expect(source).toContain('id="security-recovery-unavailable"');
  expect(source).toContain('id="security-recovery-needs-verification"');
  expect(source).toContain("title={copy.recoveryNeedsVerification}");
  expect(source).toContain("description={copy.recoveryNeedsVerificationHint}");
  expect(source).toContain("description={copy.recoveryUnavailableHint}");
  expect(source).toContain('className="mt-1 text-xs text-muted">{copy.recoveryVerified}</p>');
  expect(source).not.toContain(": copy.recoveryNeedsVerification");
  expect(source).not.toContain(": copy.recoveryUnavailable}");
});
