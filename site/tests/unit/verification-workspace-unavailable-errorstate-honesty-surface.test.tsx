import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const workspace = readFileSync(
  join(root, "site/src/features/moderation/components/verification-workspace.tsx"),
  "utf8",
);
const page = readFileSync(
  join(root, "site/src/features/moderation/server/verification-workspace-page.tsx"),
  "utf8",
);

/** Honesty lock: verification load/session failures stay ErrorState, not guest sign-in. */
it("locks verification workspace unavailable notices to ErrorState with stable id", () => {
  expect(workspace).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(workspace).toContain('id="verification-workspace-unavailable"');
  expect(workspace).toMatch(
    /<ErrorState\s+id="verification-workspace-unavailable"\s+title=\{copy\.unavailable\}\s+description=\{copy\.unavailableHint\}\s*\/>/u,
  );
  expect(workspace).toContain("description={copy.unavailableHint}");
  expect(workspace).toMatch(
    /readError \? \(\s*<ErrorState\s+id="verification-workspace-unavailable"\s+title=\{readError\}/u,
  );
  expect(page).toContain("PlatformSessionError");
  expect(page).toMatch(
    /try \{\s*actor = await authService\.getSession\([\s\S]*?\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
  );
  expect(page).toContain("message={copy.unavailable}");
  expect(page).toContain("return <PlatformSignIn locale={locale} returnPath={returnPath} />");
});
