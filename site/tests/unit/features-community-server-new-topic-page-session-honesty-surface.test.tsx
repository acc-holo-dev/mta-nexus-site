import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/server/new-topic-page.tsx"),
  "utf8",
);

/** Honesty lock: session probe failure → PlatformSessionError, not guest compose. */
it("locks new-topic session probe failure to PlatformSessionError", () => {
  expect(source).toContain("PlatformSessionError");
  expect(source).toMatch(
    /try \{\s*actor = await authService\.getSession\([\s\S]*?\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
  );
  expect(source).toContain("message={copy.topicIdentityError}");
  expect(source).toContain('retryHref="/community/new"');
  expect(source).not.toContain("GuestAuthLinks");
});
