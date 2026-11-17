import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks catalog/org/history load-unavailable ErrorStates to recovery hints", () => {
  const directory = read("site/src/features/organizations/server/directory-page.tsx");
  expect(directory).toMatch(
    /title=\{copy\.unavailable\}\s*\n\s*description=\{copy\.unavailableHint\}/u,
  );

  const articles = read("site/src/features/community/server/articles-page.tsx");
  expect(articles).toMatch(
    /title=\{platformCopy\.unavailable\}\s*\n\s*description=\{platformCopy\.unavailableHint\}/u,
  );

  const community = read("site/src/features/community/server/community-page.tsx");
  expect(community).toMatch(
    /title=\{platformCopy\.unavailable\}\s*\n\s*description=\{platformCopy\.unavailableHint\}/u,
  );

  const profileHistory = read("site/src/features/accounts/components/profile-change-history.tsx");
  expect(profileHistory).toMatch(
    /title=\{error \?\? copy\.unavailable\}\s*\n\s*description=\{copy\.unavailableHint\}/u,
  );

  const orgHistory = read("site/src/features/organizations/components/organization-history.tsx");
  expect(orgHistory).toMatch(
    /title=\{error \?\? copy\.unavailable\}\s*\n\s*description=\{copy\.unavailableHint\}/u,
  );

  expect(read("site/src/features/organizations/organization-workspace-copy.ts")).toContain(
    "unavailableHint:",
  );
  expect(read("site/src/features/community/user-platform-copy.ts")).toContain("unavailableHint:");
  expect(read("site/src/features/accounts/private-change-history-copy.ts")).toContain(
    "unavailableHint:",
  );
  expect(read("site/src/features/organizations/organization-governance-copy.ts")).toContain(
    "unavailableHint:",
  );
});
