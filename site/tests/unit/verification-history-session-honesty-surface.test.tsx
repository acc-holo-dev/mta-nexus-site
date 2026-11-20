import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/moderation/server/verification-history-screen.tsx"),
  "utf8",
);

/** Honesty lock: verification history session probe failure → PlatformSessionError, not guest. */
it("locks verification history session probe failure to PlatformSessionError without guest-lie", () => {
  expect(source).toContain('import { PlatformSessionError } from "../../shell/session-error"');
  expect(source).toMatch(
    /try \{\s*sessionActor = await authService\.getSession\([\s\S]*?\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
  );
  expect(source).toContain("title={copy.title}");
  expect(source).toContain("message={labels.unavailable}");
  expect(source).toContain("retryHref={returnPath}");
  expect(source).toContain("return <PlatformSignIn locale={locale} returnPath={returnPath} />");
  expect(source).not.toMatch(/\.getSession\([^;]*?\)\s*\.catch\(\(\) => null\)/u);
});
