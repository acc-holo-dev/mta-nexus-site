import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/support/server/support-message-page.tsx"),
  "utf8",
);

/** Honesty lock: session probe failure → PlatformSessionError, not guest sign-in. */
it("locks session probe failure to PlatformSessionError without guest-lie", () => {
  expect(source).toContain("PlatformSessionError");
  expect(source).toMatch(
    /try \{\s*token = \(await cookies\(\)\)\.get\("nexus_session"\)\?\.value;\s*actor = await authService\.getSession\(token\);\s*\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
  );
  expect(source).toContain("title={copy.title}");
  expect(source).toContain("message={copy.unavailable}");
  expect(source).toContain("PlatformSignIn");
});
