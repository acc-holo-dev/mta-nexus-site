import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/app/workspace/page.tsx"), "utf8");

/** Honesty lock: workspace hub session probe failure → PlatformSessionError, not guest sign-in. */
it("locks workspace hub session probe failure to PlatformSessionError without guest-lie", () => {
  expect(source).toContain(
    'import { PlatformSessionError } from "../../features/shell/session-error"',
  );
  expect(source).toMatch(
    /try \{\s*user = await authService\.getSession\([\s\S]*?\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
  );
  expect(source).toContain("title={dictionary.workspace.title}");
  expect(source).toContain("message={dictionary.workspace.libraryUnavailable}");
  expect(source).toContain('retryHref="/workspace"');
  expect(source).toContain(
    'if (!user) return <PlatformSignIn locale={locale} returnPath="/workspace" />',
  );
  expect(source).not.toMatch(/\.getSession\([^;]*?\)\s*\.catch\(\(\) => null\)/u);
});
