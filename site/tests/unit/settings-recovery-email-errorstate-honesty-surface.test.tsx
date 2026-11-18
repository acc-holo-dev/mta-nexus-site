import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for settings recovery email ErrorState notices. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/features/accounts/components/settings-recovery-email-section.tsx";

it("locks recovery unavailable and not-verified notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="settings-recovery-not-verified"');
  expect(source).toContain('id="settings-recovery-unavailable"');
  expect(source).toMatch(
    /<ErrorState[\s\S]*id="settings-recovery-not-verified"[\s\S]*title=\{copy\.recoveryNotVerified\}[\s\S]*description=\{copy\.recoveryNotVerifiedHint\}/,
  );
  expect(source).toMatch(
    /<ErrorState[\s\S]*id="settings-recovery-unavailable"[\s\S]*title=\{copy\.recoveryUnavailable\}[\s\S]*description=\{copy\.recoveryUnavailableHint\}/,
  );
  expect(read("site/src/lib/i18n/en/admin.ts")).toContain("recoveryNotVerifiedHint:");
  expect(read("site/src/lib/i18n/ru/admin.ts")).toContain("recoveryUnavailableHint:");
  expect(source).not.toContain("? copy.recoveryNotVerified");
  expect(source).not.toContain(": copy.recoveryUnavailable}");
});
