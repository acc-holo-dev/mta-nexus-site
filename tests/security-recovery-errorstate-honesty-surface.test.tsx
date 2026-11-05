import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/app/security/page.tsx"), "utf8");

/** Honesty lock for security-center recovery unavailable / needs-verification notices. */
it("locks security recovery unavailable and needs-verification to ErrorState", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="security-recovery-needs-verification"');
  expect(source).toContain('id="security-recovery-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="security-recovery-needs-verification" title=\{copy\.recoveryNeedsVerification\}/,
  );
  expect(source).toMatch(
    /<ErrorState id="security-recovery-unavailable" title=\{copy\.recoveryUnavailable\}/,
  );
  expect(source).toContain('className="mt-1 text-xs text-muted">{copy.recoveryVerified}</p>');
  expect(source).not.toContain(": copy.recoveryNeedsVerification");
  expect(source).not.toContain(": copy.recoveryUnavailable}");
});
