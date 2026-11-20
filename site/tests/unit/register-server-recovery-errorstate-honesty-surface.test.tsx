import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for register-server recovery/inconclusive ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/features/servers/components/register-server-form.tsx";

it("locks register-server recovery and inconclusive notices to ErrorState", () => {
  const source = read(surface);
  const copy = read("site/src/lib/i18n/en/publishing.ts");
  const copyRu = read("site/src/lib/i18n/ru/publishing.ts");
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="register-server-session-recovery"');
  expect(source).toContain('id="register-server-create-inconclusive"');
  expect(source).toContain("copy.restoreFailed");
  expect(source).toContain("description={copy.sessionRecoveryHint}");
  expect(source).toContain("copy.creationResultUnknown");
  expect(source).toContain("copy.checkResult");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("sessionRecoveryHint:");
  expect(copyRu).toContain("sessionRecoveryHint:");
  expect(copy).toContain("creationResultUnknown:");
  expect(source).not.toContain('{recoveryMessage ? <p role="status">{recoveryMessage}</p> : null}');
  expect(source).not.toContain(
    "The creation result is unknown. Your draft is saved and creating another is blocked.",
  );
  expect(source).not.toContain("const message = (ru: string, en: string)");
});
