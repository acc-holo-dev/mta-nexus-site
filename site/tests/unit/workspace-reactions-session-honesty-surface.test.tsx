import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/app/workspace/reactions/page.tsx"), "utf8");

/** Honesty lock: reactions session probe failure → PlatformSessionError, not guest sign-in. */
it("locks reactions workspace session probe failure to PlatformSessionError without guest-lie", () => {
  expect(source).toContain(
    'import { PlatformSessionError } from "../../../features/shell/session-error"',
  );
  expect(source).toMatch(
    /try \{\s*actor = await authService\.getSession\([\s\S]*?\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
  );
  expect(source).toContain("title={copy.my}");
  expect(source).toContain("message={copy.unavailable}");
  expect(source).toContain("retryHref={returnPath}");
  expect(source).toContain(
    "if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />",
  );
  expect(source).not.toMatch(/\.getSession\([^;]*?\)\s*\.catch\(\(\) => null\)/u);
});
