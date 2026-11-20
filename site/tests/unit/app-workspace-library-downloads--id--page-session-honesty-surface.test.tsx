import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/library/server/library-download-detail-page.tsx"),
  "utf8",
);

/** Honesty lock: session probe failure → PlatformSessionError, not guest sign-in. */
it("locks session probe failure to PlatformSessionError without guest-lie", () => {
  expect(source).toContain("PlatformSessionError");
  expect(source).toMatch(
    /try \{\s*user = await authService\.getSession\([\s\S]*?\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
  );
  expect(source).toContain("title={getDictionary(locale).errors.title}");
  expect(source).toContain("message={copy.loadUnavailable}");
  expect(source).toContain("PlatformSignIn");
});
